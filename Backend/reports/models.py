"""Core reporting domain for SafeVoice.

Implements the ERD tables:
    CRIME_CATEGORY, REPORT_STATUS, REPORT, EVIDENCE,
    INVESTIGATION_NOTE, STATUS_HISTORY
"""

import secrets
import string

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone

from accounts.models import User


REFERENCE_ALPHABET = string.ascii_uppercase + string.digits
REFERENCE_LENGTH = 10


def generate_reference_number():
    """Human friendly, unguessable public tracking number (ERD: REPORT.reference_number)."""
    while True:
        body = "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(REFERENCE_LENGTH))
        reference = f"SV-{body}"
        if not Report.objects.filter(reference_number=reference).exists():
            return reference


def generate_access_key():
    """Secret key handed to the reporter so they can track their own report."""
    return secrets.token_urlsafe(24)


def default_status():
    """Status a freshly submitted report starts in (Submitted)."""
    return (
        ReportStatus.objects.filter(slug="submitted").first()
        or ReportStatus.objects.order_by("order", "name").first()
    )


class CrimeCategory(models.Model):
    """ERD: CRIME_CATEGORY - admin managed incident types (story 13)."""

    id = models.BigAutoField(primary_key=True, db_column="category_id")
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_categories",
        db_column="created_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "crime_category"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ReportStatus(models.Model):
    """ERD: REPORT_STATUS - lookup table for the report lifecycle."""

    id = models.BigAutoField(primary_key=True, db_column="status_id")
    name = models.CharField(max_length=30, unique=True)
    slug = models.SlugField(max_length=30, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_public = models.BooleanField(
        default=False,
        help_text="Reports in this status are visible on the public complaints page.",
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "report_status"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Report(models.Model):
    """ERD: REPORT - an anonymous crime report."""

    id = models.BigAutoField(primary_key=True, db_column="report_id")
    reference_number = models.CharField(max_length=20, unique=True, default=generate_reference_number)
    access_key_hash = models.CharField(max_length=255, blank=True)

    category = models.ForeignKey(
        CrimeCategory,
        on_delete=models.PROTECT,
        related_name="reports",
    )
    status = models.ForeignKey(
        ReportStatus,
        on_delete=models.PROTECT,
        related_name="reports",
    )
    assigned_investigator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_reports",
    )

    description = models.TextField()
    incident_datetime = models.DateTimeField(null=True, blank=True)

    location_text = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )

    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=255, blank=True)

    submitted_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "report"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.reference_number} - {self.category.name}"

    def set_access_key(self, raw_key):
        """Store only a hash of the secret tracking key."""
        from django.contrib.auth.hashers import make_password

        self.access_key_hash = make_password(raw_key)

    def check_access_key(self, raw_key):
        from django.contrib.auth.hashers import check_password

        if not self.access_key_hash:
            return False
        return check_password(raw_key, self.access_key_hash)


class Evidence(models.Model):
    """ERD: EVIDENCE - photos, videos and documents attached to a report."""

    id = models.BigAutoField(primary_key=True, db_column="evidence_id")
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="evidence")
    file_path = models.FileField(
        upload_to="evidence/%Y/%m/",
        max_length=255,
        db_column="file_path",
    )
    file_type = models.CharField(max_length=50, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "evidence"
        ordering = ["uploaded_at"]

    def __str__(self):
        return f"Evidence for {self.report.reference_number}"


class InvestigationNote(models.Model):
    """ERD: INVESTIGATION_NOTE - notes written by investigators (story 12)."""

    id = models.BigAutoField(primary_key=True, db_column="note_id")
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="notes")
    investigator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="investigation_notes",
    )
    note_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "investigation_note"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note by {self.investigator.full_name} on {self.report.reference_number}"


class StatusHistory(models.Model):
    """ERD: STATUS_HISTORY - audit log of every status change (story 11)."""

    id = models.BigAutoField(primary_key=True, db_column="history_id")
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="status_history")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="status_changes",
        db_column="changed_by",
    )
    old_status = models.ForeignKey(
        ReportStatus, on_delete=models.PROTECT, related_name="+", null=True
    )
    new_status = models.ForeignKey(ReportStatus, on_delete=models.PROTECT, related_name="+")
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "status_history"
        ordering = ["-changed_at"]

    def __str__(self):
        return f"{self.report.reference_number}: {self.old_status} -> {self.new_status}"
