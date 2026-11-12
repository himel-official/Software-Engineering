from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import AdminUserViewSet, LoginView, LogoutView, MeView

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("", include(router.urls)),
]
