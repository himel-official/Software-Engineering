import os

from django.contrib.auth.hashers import check_password, make_password
from rest_framework import serializers

from accounts.models import User
from reports.models import (
    CrimeCategory,
    Evidence,
    InvestigationNote,
    Report,
    ReportStatus,
    StatusHistory,
    default_status,
)

ALLOWED_EVIDENCE_EXTENSIONS = {
    # images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic",
    # video
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp",
    # documents
    ".pdf", ".doc", ".docx", ".txt", ".rtf",
}
MAX_EVIDENCE_SIZE = 25 * 1024 * 1024  # 25 MB per file


class CrimeCategorySerializer(serializers.ModelSerializer):
    """ERD: CRIME_CATEGORY."""

    class Meta:
        model = CrimeCategory
        fields = ["id", "name", "description", "is_active", "created_by", "created_at"]
        read_only_fields = ["id", "created_by", "created_at"]


class ReportStatusSerializer(serializers.ModelSerializer):
    """ERD: REPORT_STATUS."""

    class Meta:
        model = ReportStatus
        fields = ["id", "name", "slug", "description", "is_public", "order"]
        read_only_fields = ["id", "slug"]


class EvidenceSerializer(serializers.ModelSerializer):
    """ERD: EVIDENCE."""

    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = ["id", "report_id", "file_url", "file_name", "file_type", "file_size", "uploaded_at"]
        read_only_fields = fields

    def get_file_url(self, obj):
        try:
            return obj.file_path.url
        except (ValueError, NotImplementedError):
            return ""

    def get_file_name(self, obj):
        return os.path.basename(obj.file_path.name) if obj.file_path else ""


class InvestigationNoteSerializer(serializers.ModelSerializer):
    """ERD: INVESTIGATION_NOTE."""

    investigator_id = serializers.IntegerField(source="investigator.id", read_only=True)
    investigator_name = serializers.CharField(source="investigator.full_name", read_only=True)

    class Meta:
        model = InvestigationNote
        fields = ["id", "report_id", "investigator_id", "investigator_name", "note_text", "created_at"]
        read_only_fields = ["id", "investigator_id", "investigator_name", "created_at"]


class StatusHistorySerializer(serializers.ModelSerializer):
    """ERD: STATUS_HISTORY."""

    changed_by_name = serializers.CharField(
        source="changed_by.full_name", read_only=True, default="System"
    )
    old_status_name = serializers.CharField(source="old_status.name", read_only=True, default=None)
    new_status_name = serializers.CharField(source="new_status.name", read_only=True)

    class Meta:
        model = StatusHistory
        fields = [
            "id",
            "report_id",
            "changed_by_name",
            "old_status_name",
            "new_status_name",
            "changed_at",
        ]
        read_only_fields = fields


class ReportPublicSerializer(serializers.ModelSerializer):
    """Public view of a report - no reporter identity, no internal notes."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    status_name = serializers.CharField(source="status.name", read_only=True)
    status_slug = serializers.CharField(source="status.slug", read_only=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "reference_number",
            "category_name",
            "status_name",
            "status_slug",
            "description",
            "incident_datetime",
            "location_text",
            "latitude",
            "longitude",
            "submitted_at",
        ]
        read_only_fields = fields


class ReportDetailSerializer(serializers.ModelSerializer):
    """Full view used by investigators and admins."""

    category = CrimeCategorySerializer(read_only=True)
    status = ReportStatusSerializer(read_only=True)
    assigned_investigator = serializers.CharField(
        source="assigned_investigator.full_name", read_only=True, default=None
    )
    assigned_investigator_id = serializers.IntegerField(
        source="assigned_investigator.id", read_only=True, default=None
    )
    evidence = EvidenceSerializer(many=True, read_only=True)
    notes = InvestigationNoteSerializer(many=True, read_only=True)
    status_history = StatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Report
        fields = [
            "id",
            "reference_number",
            "category",
            "status",
            "assigned_investigator",
            "assigned_investigator_id",
            "description",
            "incident_datetime",
            "location_text",
            "latitude",
            "longitude",
            "is_flagged",
            "flag_reason",
            "submitted_at",
            "updated_at",
            "evidence",
            "notes",
            "status_history",
        ]
        read_only_fields = fields


class ReportListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    status_name = serializers.CharField(source="status.name", read_only=True)
    status_slug = serializers.CharField(source="status.slug", read_only=True)
    assigned_investigator_name = serializers.CharField(
        source="assigned_investigator.full_name", read_only=True, default=None
    )
    evidence_count = serializers.SerializerMethodField()
    note_count = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id",
            "reference_number",
            "category_name",
            "status_name",
            "status_slug",
            "assigned_investigator_name",
            "description",
            "incident_datetime",
            "location_text",
            "latitude",
            "longitude",
            "is_flagged",
            "flag_reason",
            "submitted_at",
            "updated_at",
            "evidence_count",
            "note_count",
        ]
        read_only_fields = fields

    def get_evidence_count(self, obj):
        return obj.evidence.count()

    def get_note_count(self, obj):
        return obj.notes.count()


class ReportCreateSerializer(serializers.ModelSerializer):
    """Anonymous submission payload."""

    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=CrimeCategory.objects.filter(is_active=True),
        error_messages={"does_not_exist": "That incident category is not available."},
    )
    evidence_files = serializers.ListField(
        child=serializers.FileField(), required=False, write_only=True
    )

    class Meta:
        model = Report
        fields = [
            "category_id",
            "description",
            "incident_datetime",
            "location_text",
            "latitude",
            "longitude",
            "evidence_files",
        ]

    def validate_evidence_files(self, files):
        for uploaded in files:
            extension = os.path.splitext(uploaded.name)[1].lower()
            if extension not in ALLOWED_EVIDENCE_EXTENSIONS:
                raise serializers.ValidationError(
                    f"'{uploaded.name}' has an unsupported file type ({extension or 'unknown'})."
                )
            if uploaded.size > MAX_EVIDENCE_SIZE:
                raise serializers.ValidationError(
                    f"'{uploaded.name}' is larger than the 25 MB limit."
                )
        return files

    def create(self, validated_data):
        files = validated_data.pop("evidence_files", [])
        access_key = validated_data.pop("access_key", None)

        start_status = default_status()
        if start_status is None:
            raise serializers.ValidationError(
                "The report status lookup table is empty. Run `manage.py seed_safevoice`."
            )

        report = Report.objects.create(status=start_status, **validated_data)
        if access_key:
            report.set_access_key(access_key)
            report.save(update_fields=["access_key_hash"])

        # Open the STATUS_HISTORY audit trail with the initial status so the
        # lifecycle of every report is traceable from the moment it arrives.
        StatusHistory.objects.create(
            report=report,
            changed_by=None,
            old_status=None,
            new_status=start_status,
        )

        self._store_evidence(report, files)
        return report

    def _store_evidence(self, report, files):
        for uploaded in files:
            extension = os.path.splitext(uploaded.name)[1].lower()
            Evidence.objects.create(
                report=report,
                file_path=uploaded,
                file_type=extension.lstrip(".") or "unknown",
                file_size=uploaded.size,
            )


class ReportStatusUpdateSerializer(serializers.Serializer):
    """Payload for changing a report status (story 11)."""

    status_id = serializers.IntegerField()
    assigned_investigator_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_status_id(self, value):
        if not ReportStatus.objects.filter(pk=value).exists():
            raise serializers.ValidationError("That report status does not exist.")
        return value

    def validate_assigned_investigator_id(self, value):
        if value in (None, ""):
            return None
        if not User.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("That investigator account does not exist.")
        return value


class ReportFlagSerializer(serializers.Serializer):
    """Payload for flagging / unflagging a report (story 16)."""

    is_flagged = serializers.BooleanField()
    flag_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("is_flagged") and not attrs.get("flag_reason", "").strip():
            raise serializers.ValidationError(
                {"flag_reason": "A reason is required when flagging a report."}
            )
        return attrs


class InvestigationNoteCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestigationNote
        fields = ["note_text"]

    def validate_note_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("A note cannot be empty.")
        return value.strip()
