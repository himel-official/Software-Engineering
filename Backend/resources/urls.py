from django.urls import include, path
from rest_framework.routers import DefaultRouter

from resources.views import (
    AdminEmergencyContactViewSet,
    AdminGuidelineViewSet,
    AdminSystemSettingViewSet,
    EmergencyContactListView,
    SafetyGuidelineListView,
)

router = DefaultRouter()
router.register("admin/guidelines", AdminGuidelineViewSet, basename="admin-guideline")
router.register(
    "admin/emergency-contacts", AdminEmergencyContactViewSet, basename="admin-emergency-contact"
)
router.register("admin/settings", AdminSystemSettingViewSet, basename="admin-setting")

urlpatterns = [
    # --- Public ---
    path("emergency-contacts/", EmergencyContactListView.as_view(), name="emergency-contacts"),
    path("guidelines/", SafetyGuidelineListView.as_view(), name="guidelines"),
    # --- Admin ---
    path("", include(router.urls)),
]
