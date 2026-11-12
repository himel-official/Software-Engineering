from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.models import User
from accounts.permissions import IsAdmin, IsInvestigatorOrAdmin
from reports.models import (
    CrimeCategory,
    Evidence,
    InvestigationNote,
    Report,
    ReportStatus,
    StatusHistory,
    generate_access_key,
)
from reports.serializers import (
    CrimeCategorySerializer,
    EvidenceSerializer,
    InvestigationNoteCreateSerializer,
    InvestigationNoteSerializer,
    ReportCreateSerializer,
    ReportDetailSerializer,
    ReportFlagSerializer,
    ReportListSerializer,
    ReportPublicSerializer,
    ReportStatusUpdateSerializer,
    ReportStatusSerializer,
)


def public_visible_statuses():
    """Statuses whose reports are shown on the public complaints page."""
    from resources.models import SystemSetting

    setting = SystemSetting.objects.filter(setting_key="public_visible_statuses").first()
    if setting and setting.setting_value.strip():
        slugs = [s.strip() for s in setting.setting_value.split(",") if s.strip()]
        return ReportStatus.objects.filter(slug__in=slugs)
    return ReportStatus.objects.filter(is_public=True)


# ---------------------------------------------------------------------------
# Public (anonymous) endpoints
# ---------------------------------------------------------------------------


class ReportCreateView(APIView):
    """Anonymous report submission (stories 1, 2, 3, 4, 5)."""

    permission_classes = [AllowAny]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access_key = generate_access_key()
        report = serializer.save(access_key=access_key)

        return Response(
            {
                "success": True,
                "message": "Report submitted successfully.",
                "reference_number": report.reference_number,
                "access_key": access_key,
                "report": ReportPublicSerializer(report).data,
                "evidence": EvidenceSerializer(report.evidence.all(), many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PublicReportListView(APIView):
    """Publicly visible reports (stories 8, 9 - read only, no identities)."""

    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Report.objects.filter(
            status__in=public_visible_statuses(),
            is_flagged=False,
        ).select_related("category", "status")

        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category_id=category)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(description__icontains=search)
                | Q(location_text__icontains=search)
                | Q(reference_number__icontains=search)
            )

        queryset = queryset.order_by("-submitted_at")
        serializer = ReportPublicSerializer(queryset, many=True)
        return Response({"success": True, "count": queryset.count(), "data": serializer.data})


class TrackReportView(APIView):
    """Track a report with its reference number and secret access key (story 6)."""

    permission_classes = [AllowAny]

    def get(self, request):
        reference = (request.query_params.get("reference") or "").strip().upper()
        access_key = (request.query_params.get("access_key") or "").strip()

        if not reference or not access_key:
            return Response(
                {"success": False, "message": "Both the reference number and access key are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report = Report.objects.filter(reference_number=reference).first()
        if report is None or not report.check_access_key(access_key):
            return Response(
                {"success": False, "message": "No report matches that reference number and access key."},
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = ReportPublicSerializer(report).data
        payload.update(
            {
                "is_flagged": report.is_flagged,
                "flag_reason": report.flag_reason if report.is_flagged else "",
                "evidence": EvidenceSerializer(report.evidence.all(), many=True).data,
                "status_history": [
                    {
                        "new_status_name": entry.new_status.name,
                        "old_status_name": entry.old_status.name if entry.old_status else None,
                        "changed_at": entry.changed_at,
                    }
                    for entry in report.status_history.select_related("old_status", "new_status")
                ],
            }
        )
        return Response({"success": True, "data": payload})


class CrimeCategoryListView(APIView):
    """Active incident categories offered on the public report form."""

    permission_classes = [AllowAny]

    def get(self, request):
        queryset = CrimeCategory.objects.filter(is_active=True)
        serializer = CrimeCategorySerializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


class ReportStatusListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = ReportStatus.objects.all()
        serializer = ReportStatusSerializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})


# ---------------------------------------------------------------------------
# Investigator endpoints
# ---------------------------------------------------------------------------


class ManageReportListView(APIView):
    """All reports for investigators and admins, with filtering (story 10)."""

    permission_classes = [IsInvestigatorOrAdmin]

    def get(self, request):
        queryset = Report.objects.select_related("category", "status", "assigned_investigator")

        status_slug = request.query_params.get("status")
        if status_slug and status_slug.lower() != "all":
            queryset = queryset.filter(status__slug=status_slug)

        category = request.query_params.get("category")
        if category and category.lower() != "all":
            queryset = queryset.filter(category_id=category)

        location = request.query_params.get("location", "").strip()
        if location:
            queryset = queryset.filter(
                Q(location_text__icontains=location)
                | Q(latitude__icontains=location.replace(".", "", 1))
            )

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(reference_number__icontains=search)
                | Q(description__icontains=search)
                | Q(location_text__icontains=search)
            )

        flagged = request.query_params.get("flagged")
        if flagged in ("true", "1"):
            queryset = queryset.filter(is_flagged=True)

        assigned = request.query_params.get("assigned")
        if assigned == "me":
            queryset = queryset.filter(assigned_investigator=request.user)
        elif assigned == "unassigned":
            queryset = queryset.filter(assigned_investigator__isnull=True)

        ordering = request.query_params.get("ordering", "-submitted_at")
        allowed_ordering = {
            "-submitted_at", "submitted_at", "-updated_at", "updated_at", "reference_number",
        }
        if ordering not in allowed_ordering:
            ordering = "-submitted_at"
        queryset = queryset.order_by(ordering)

        serializer = ReportListSerializer(queryset, many=True)
        return Response({"success": True, "count": queryset.count(), "data": serializer.data})


class InvestigatorListView(APIView):
    """Staff accounts a report can be assigned to (investigators and admins)."""

    permission_classes = [IsInvestigatorOrAdmin]

    def get(self, request):
        users = User.objects.filter(is_active=True).order_by("full_name")
        return Response(
            {
                "success": True,
                "data": [
                    {"id": user.id, "full_name": user.full_name, "role": user.role}
                    for user in users
                ],
            }
        )


class ManageReportDetailView(APIView):
    """Full report detail including evidence, notes and status history."""

    permission_classes = [IsInvestigatorOrAdmin]

    def get(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ReportDetailSerializer(report)
        return Response({"success": True, "data": serializer.data})


class ReportStatusUpdateView(APIView):
    """Change report status and record it in STATUS_HISTORY (story 11)."""

    permission_classes = [IsInvestigatorOrAdmin]

    def patch(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReportStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = ReportStatus.objects.get(pk=serializer.validated_data["status_id"])
        old_status = report.status

        assigned_investigator_id = serializer.validated_data.get("assigned_investigator_id", "__unset__")
        if assigned_investigator_id != "__unset__":
            report.assigned_investigator_id = assigned_investigator_id

        if report.status_id != new_status.pk:
            StatusHistory.objects.create(
                report=report,
                changed_by=request.user,
                old_status=old_status,
                new_status=new_status,
            )
        report.status = new_status
        report.save()

        return Response(
            {
                "success": True,
                "message": "Report status updated.",
                "data": ReportDetailSerializer(report).data,
            },
            status=status.HTTP_200_OK,
        )


class ReportNoteListCreateView(APIView):
    """List and add investigation notes (story 12)."""

    permission_classes = [IsInvestigatorOrAdmin]

    def get(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
        notes = report.notes.select_related("investigator")
        serializer = InvestigationNoteSerializer(notes, many=True)
        return Response({"success": True, "data": serializer.data})

    def post(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = InvestigationNoteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(report=report, investigator=request.user)
        return Response(
            {"success": True, "message": "Note added.", "data": InvestigationNoteSerializer(note).data},
            status=status.HTTP_201_CREATED,
        )


class ReportEvidenceUploadView(APIView):
    """Attach evidence files to an existing report."""

    permission_classes = [IsInvestigatorOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        uploaded_files = request.FILES.getlist("evidence_files")
        if not uploaded_files:
            return Response(
                {"success": False, "message": "No files were uploaded."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from reports.serializers import ReportCreateSerializer

        validator = ReportCreateSerializer()
        try:
            validator.validate_evidence_files(uploaded_files)
        except Exception as exc:  # noqa: BLE001 - DRF ValidationError
            detail = getattr(exc, "detail", exc)
            return Response({"success": False, "message": detail}, status=status.HTTP_400_BAD_REQUEST)

        validator._store_evidence(report, uploaded_files)
        report.save(update_fields=["updated_at"])

        evidence = report.evidence.all()
        return Response(
            {
                "success": True,
                "message": "Evidence uploaded.",
                "data": EvidenceSerializer(evidence, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


class AdminReportListView(APIView):
    """Every report including flagged and in-progress ones (stories 15, 16)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = Report.objects.select_related("category", "status", "assigned_investigator")

        status_slug = request.query_params.get("status")
        if status_slug and status_slug.lower() != "all":
            queryset = queryset.filter(status__slug=status_slug)

        flagged = request.query_params.get("flagged")
        if flagged in ("true", "1"):
            queryset = queryset.filter(is_flagged=True)
        elif flagged in ("false", "0"):
            queryset = queryset.filter(is_flagged=False)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(reference_number__icontains=search)
                | Q(description__icontains=search)
                | Q(location_text__icontains=search)
            )

        queryset = queryset.order_by("-submitted_at")
        serializer = ReportListSerializer(queryset, many=True)
        return Response({"success": True, "count": queryset.count(), "data": serializer.data})


class AdminReportFlagView(APIView):
    """Flag or unflag a report as inappropriate / false (story 16)."""

    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        report = Report.objects.filter(pk=pk).first()
        if report is None:
            return Response({"success": False, "message": "Report not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReportFlagSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report.is_flagged = serializer.validated_data["is_flagged"]
        report.flag_reason = serializer.validated_data.get("flag_reason", "")
        report.save(update_fields=["is_flagged", "flag_reason", "updated_at"])

        return Response(
            {
                "success": True,
                "message": "Report flag updated.",
                "data": ReportDetailSerializer(report).data,
            },
            status=status.HTTP_200_OK,
        )


class StatisticsView(APIView):
    """Dashboard statistics computed from REPORT, REPORT_STATUS and CRIME_CATEGORY (story 17)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        total = Report.objects.count()
        flagged = Report.objects.filter(is_flagged=True).count()
        today = timezone.now().date()
        today_count = Report.objects.filter(submitted_at__date=today).count()

        by_status = list(
            Report.objects.values("status__id", "status__name", "status__slug")
            .annotate(count=Count("id"))
            .order_by("status__id")
        )
        by_category = list(
            Report.objects.values("category__id", "category__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        by_location = list(
            Report.objects.exclude(location_text="")
            .values("location_text")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )

        recent = Report.objects.select_related("category", "status").order_by("-submitted_at")[:5]

        return Response(
            {
                "success": True,
                "data": {
                    "total_reports": total,
                    "flagged_reports": flagged,
                    "today_reports": today_count,
                    "unassigned_reports": Report.objects.filter(assigned_investigator__isnull=True).count(),
                    "by_status": [
                        {"id": row["status__id"], "name": row["status__name"], "slug": row["status__slug"], "count": row["count"]}
                        for row in by_status
                    ],
                    "by_category": [
                        {"id": row["category__id"], "name": row["category__name"], "count": row["count"]}
                        for row in by_category
                    ],
                    "top_locations": by_location,
                    "recent_reports": ReportListSerializer(recent, many=True).data,
                },
            }
        )


class AdminCategoryViewSet(ModelViewSet):
    """Manage incident categories (story 13)."""

    permission_classes = [IsAdmin]
    queryset = CrimeCategory.objects.select_related("created_by").order_by("name")
    serializer_class = CrimeCategorySerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Categories referenced by reports are deactivated instead of deleted."""
        category = self.get_object()
        if category.reports.exists():
            category.is_active = False
            category.save(update_fields=["is_active"])
            return Response(
                {
                    "success": True,
                    "message": "Category is used by existing reports and has been deactivated instead of deleted.",
                    "data": CrimeCategorySerializer(category).data,
                },
            )
        category.delete()
        return Response({"success": True, "message": "Category deleted."}, status=status.HTTP_204_NO_CONTENT)
