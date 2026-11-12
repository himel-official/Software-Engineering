"""Public resource content managed by administrators.

Implements the ERD tables:
    EMERGENCY_CONTACT, SAFETY_GUIDELINE, SYSTEM_SETTING
"""

from django.conf import settings
from django.db import models


class EmergencyContact(models.Model):
    """ERD: EMERGENCY_CONTACT - shown to guests and citizens (stories 7, 18)."""

    id = models.BigAutoField(primary_key=True, db_column="contact_id")
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30)
    description = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_emergency_contacts",
        db_column="created_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "emergency_contact"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} - {self.phone}"


class SafetyGuideline(models.Model):
    """ERD: SAFETY_GUIDELINE - safety guidance for guests and citizens (stories 7, 19)."""

    id = models.BigAutoField(primary_key=True, db_column="guideline_id")
    title = models.CharField(max_length=150)
    content = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_guidelines",
        db_column="created_by",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "safety_guideline"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title


class SystemSetting(models.Model):
    """ERD: SYSTEM_SETTING - configurable system settings managed by admins."""

    id = models.BigAutoField(primary_key=True, db_column="setting_id")
    setting_key = models.CharField(max_length=100, unique=True)
    setting_value = models.CharField(max_length=255, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_settings",
        db_column="updated_by",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_setting"
        ordering = ["setting_key"]

    def __str__(self):
        return f"{self.setting_key} = {self.setting_value}"
