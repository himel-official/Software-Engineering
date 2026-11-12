from django.contrib import admin

from reports.models import (
    CrimeCategory,
    Evidence,
    InvestigationNote,
    Report,
    ReportStatus,
    StatusHistory,
)


@admin.register(CrimeCategory)
class CrimeCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_by", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(ReportStatus)
class ReportStatusAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_public", "order")
    list_filter = ("is_public",)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = (
        "reference_number",
        "category",
        "status",
        "assigned_investigator",
        "is_flagged",
        "submitted_at",
    )
    list_filter = ("status", "category", "is_flagged")
    search_fields = ("reference_number", "description", "location_text")
    readonly_fields = ("reference_number", "submitted_at")


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "file_type", "file_size", "uploaded_at")


@admin.register(InvestigationNote)
class InvestigationNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "investigator", "created_at")
    search_fields = ("note_text",)


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "old_status", "new_status", "changed_by", "changed_at")
