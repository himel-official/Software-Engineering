from django.urls import include, path
from rest_framework.routers import DefaultRouter

from reports.views import (
    AdminCategoryViewSet,
    AdminReportFlagView,
    AdminReportListView,
    CrimeCategoryListView,
    InvestigatorListView,
    ManageReportDetailView,
    ManageReportListView,
    PublicReportListView,
    ReportCreateView,
    ReportEvidenceUploadView,
    ReportNoteListCreateView,
    ReportStatusListView,
    ReportStatusUpdateView,
    StatisticsView,
    TrackReportView,
)

router = DefaultRouter()
router.register("admin/categories", AdminCategoryViewSet, basename="admin-category")

urlpatterns = [
    # --- Public (anonymous) ---
    path("reports/", ReportCreateView.as_view(), name="report-create"),
    path("reports/public/", PublicReportListView.as_view(), name="report-public"),
    path("reports/track/", TrackReportView.as_view(), name="report-track"),
    path("categories/", CrimeCategoryListView.as_view(), name="category-list"),
    path("report-statuses/", ReportStatusListView.as_view(), name="status-list"),
    # --- Investigator ---
    path("reports/manage/", ManageReportListView.as_view(), name="report-manage-list"),
    path(
        "reports/manage/investigators/",
        InvestigatorListView.as_view(),
        name="report-investigator-list",
    ),
    path("reports/manage/<int:pk>/", ManageReportDetailView.as_view(), name="report-manage-detail"),
    path("reports/manage/<int:pk>/status/", ReportStatusUpdateView.as_view(), name="report-status-update"),
    path("reports/manage/<int:pk>/notes/", ReportNoteListCreateView.as_view(), name="report-notes"),
    path("reports/manage/<int:pk>/evidence/", ReportEvidenceUploadView.as_view(), name="report-evidence"),
    # --- Admin ---
    path("admin/reports/", AdminReportListView.as_view(), name="admin-report-list"),
    path("admin/reports/<int:pk>/flag/", AdminReportFlagView.as_view(), name="admin-report-flag"),
    path("admin/statistics/", StatisticsView.as_view(), name="admin-statistics"),
    path("", include(router.urls)),
]
