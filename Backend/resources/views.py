from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.permissions import IsAdmin
from resources.models import EmergencyContact, SafetyGuideline, SystemSetting
from resources.serializers import (
    EmergencyContactSerializer,
    SafetyGuidelineSerializer,
    SystemSettingSerializer,
)


class EmergencyContactListView(APIView):
    """Emergency numbers shown to guests and citizens (stories 7, 18)."""

    permission_classes = [AllowAny]

    def get(self, request):
        queryset = EmergencyContact.objects.all()
        serializer = EmergencyContactSerializer(queryset, many=True)
        return Response({"success": True, "count": queryset.count(), "data": serializer.data})


class SafetyGuidelineListView(APIView):
    """Safety guidance shown to guests and citizens (stories 7, 19)."""

    permission_classes = [AllowAny]

    def get(self, request):
        queryset = SafetyGuideline.objects.all()
        serializer = SafetyGuidelineSerializer(queryset, many=True)
        return Response({"success": True, "count": queryset.count(), "data": serializer.data})


class AdminGuidelineViewSet(ModelViewSet):
    """Manage safety guidelines (story 19)."""

    permission_classes = [IsAdmin]
    queryset = SafetyGuideline.objects.select_related("created_by").order_by("-updated_at")
    serializer_class = SafetyGuidelineSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminEmergencyContactViewSet(ModelViewSet):
    """Manage emergency contacts (story 18)."""

    permission_classes = [IsAdmin]
    queryset = EmergencyContact.objects.select_related("created_by").order_by("name")
    serializer_class = EmergencyContactSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(created_by=self.request.user)


class AdminSystemSettingViewSet(ModelViewSet):
    """Manage system settings."""

    permission_classes = [IsAdmin]
    queryset = SystemSetting.objects.select_related("updated_by").order_by("setting_key")
    serializer_class = SystemSettingSerializer

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
