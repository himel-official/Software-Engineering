from rest_framework import serializers

from resources.models import EmergencyContact, SafetyGuideline, SystemSetting


class EmergencyContactSerializer(serializers.ModelSerializer):
    """ERD: EMERGENCY_CONTACT."""

    class Meta:
        model = EmergencyContact
        fields = ["id", "name", "phone", "description", "created_by", "created_at"]
        read_only_fields = ["id", "created_by", "created_at"]


class SafetyGuidelineSerializer(serializers.ModelSerializer):
    """ERD: SAFETY_GUIDELINE."""

    class Meta:
        model = SafetyGuideline
        fields = ["id", "title", "content", "created_by", "updated_at"]
        read_only_fields = ["id", "created_by", "updated_at"]


class SystemSettingSerializer(serializers.ModelSerializer):
    """ERD: SYSTEM_SETTING."""

    class Meta:
        model = SystemSetting
        fields = ["id", "setting_key", "setting_value", "updated_by", "updated_at"]
        read_only_fields = ["id", "updated_by", "updated_at"]
