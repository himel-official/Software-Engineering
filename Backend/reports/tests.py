"""API tests that map directly onto the SafeVoice user stories."""

import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import Role, User
from reports.models import CrimeCategory, Report, ReportStatus
from resources.models import EmergencyContact, SafetyGuideline, SystemSetting


def png_bytes():
    """Smallest valid 1x1 PNG."""
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
        b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
        b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


class BaseCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            email="admin@test.com", password="AdminPass#123", full_name="Admin User", role=Role.ADMIN
        )
        self.investigator = User.objects.create_user(
            email="inv@test.com",
            password="InvPass#123",
            full_name="Inv User",
            role=Role.INVESTIGATOR,
        )
        self.other_investigator = User.objects.create_user(
            email="inv2@test.com",
            password="InvPass#123",
            full_name="Inv Two",
            role=Role.INVESTIGATOR,
        )

        self.submitted = ReportStatus.objects.create(name="Submitted", slug="submitted", order=1)
        self.review = ReportStatus.objects.create(name="Under Review", slug="under-review", order=2)
        self.resolved = ReportStatus.objects.create(
            name="Resolved", slug="resolved", is_public=True, order=3
        )

        self.theft = CrimeCategory.objects.create(name="Theft", description="Stolen property")
        self.assault = CrimeCategory.objects.create(name="Physical Assault")

    def auth(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return token

    def make_report(self, **overrides):
        payload = {
            "category_id": self.theft.id,
            "description": "Someone stole my bag near the market.",
            "incident_datetime": "2026-10-20T14:30:00Z",
            "location_text": "Dhanmondi, Dhaka",
            "latitude": "23.746100",
            "longitude": "90.375500",
        }
        payload.update(overrides)
        return self.client.post(reverse("report-create"), payload, format="json")


class AnonymousReportTests(BaseCase):
    """Stories 1, 2, 3, 4, 5 - submit a report anonymously."""

    def test_submit_returns_reference_number_and_access_key(self):
        response = self.make_report()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertTrue(body["reference_number"].startswith("SV-"))
        self.assertTrue(body["access_key"])
        # No identity fields are ever accepted or stored.
        self.assertNotIn("reporter", body["report"])

    def test_reference_numbers_are_unique(self):
        first = self.make_report().json()["reference_number"]
        second = self.make_report().json()["reference_number"]
        self.assertNotEqual(first, second)

    def test_evidence_upload_is_stored(self):
        upload = SimpleUploadedFile("scene.png", png_bytes(), content_type="image/png")
        response = self.client.post(
            reverse("report-create"),
            {
                "category_id": self.theft.id,
                "description": "Photo evidence attached.",
                "location_text": "Mirpur",
                "evidence_files": [upload],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        report = Report.objects.get(reference_number=response.json()["reference_number"])
        self.assertEqual(report.evidence.count(), 1)
        evidence = report.evidence.first()
        self.assertEqual(evidence.file_type, "png")
        self.assertGreater(evidence.file_size, 0)

    def test_rejects_unsupported_file_type(self):
        upload = SimpleUploadedFile("payload.exe", b"MZ", content_type="application/octet-stream")
        response = self.client.post(
            reverse("report-create"),
            {
                "category_id": self.theft.id,
                "description": "Bad file",
                "evidence_files": [upload],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    def test_inactive_category_is_rejected(self):
        self.assault.is_active = False
        self.assault.save()
        response = self.make_report(category_id=self.assault.id)
        self.assertEqual(response.status_code, 400)

    def test_submission_opens_the_status_history_audit_trail(self):
        created = self.make_report().json()
        report = Report.objects.get(reference_number=created["reference_number"])
        entries = report.status_history.all()
        self.assertEqual(entries.count(), 1)
        entry = entries.first()
        self.assertIsNone(entry.old_status)
        self.assertEqual(entry.new_status, self.submitted)
        self.assertIsNone(entry.changed_by)

    def test_create_response_lists_the_uploaded_evidence(self):
        upload = SimpleUploadedFile("scene.png", png_bytes(), content_type="image/png")
        response = self.client.post(
            reverse("report-create"),
            {
                "category_id": self.theft.id,
                "description": "Photo evidence attached.",
                "location_text": "Mirpur",
                "evidence_files": [upload],
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["evidence"]), 1)


class TrackingTests(BaseCase):
    """Story 6 - track a report with the reference number."""

    def test_track_with_correct_credentials(self):
        created = self.make_report().json()
        response = self.client.get(
            reverse("report-track"),
            {"reference": created["reference_number"], "access_key": created["access_key"]},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["reference_number"], created["reference_number"])
        self.assertEqual(data["status_name"], "Submitted")

    def test_track_with_wrong_access_key_is_rejected(self):
        created = self.make_report().json()
        response = self.client.get(
            reverse("report-track"),
            {"reference": created["reference_number"], "access_key": "wrong-key"},
        )
        self.assertEqual(response.status_code, 404)

    def test_track_requires_both_values(self):
        response = self.client.get(reverse("report-track"), {"reference": "SV-XXXX"})
        self.assertEqual(response.status_code, 400)

    def test_reference_is_case_insensitive(self):
        created = self.make_report().json()
        response = self.client.get(
            reverse("report-track"),
            {
                "reference": created["reference_number"].lower(),
                "access_key": created["access_key"],
            },
        )
        self.assertEqual(response.status_code, 200)

    def test_track_returns_the_evidence_the_reporter_uploaded(self):
        upload = SimpleUploadedFile("scene.png", png_bytes(), content_type="image/png")
        created = self.client.post(
            reverse("report-create"),
            {
                "category_id": self.theft.id,
                "description": "Photo evidence attached.",
                "location_text": "Mirpur",
                "evidence_files": [upload],
            },
            format="multipart",
        ).json()

        response = self.client.get(
            reverse("report-track"),
            {"reference": created["reference_number"], "access_key": created["access_key"]},
        )
        self.assertEqual(response.status_code, 200)
        evidence = response.json()["data"]["evidence"]
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0]["file_type"], "png")

    def test_track_returns_the_status_history(self):
        created = self.make_report().json()
        response = self.client.get(
            reverse("report-track"),
            {"reference": created["reference_number"], "access_key": created["access_key"]},
        )
        history = response.json()["data"]["status_history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["new_status_name"], "Submitted")
        self.assertIsNone(history[0]["old_status_name"])


class PublicListingTests(BaseCase):
    """Stories 8, 9 - public complaints list."""

    def test_only_resolved_unflagged_reports_are_public(self):
        public_report = Report.objects.create(
            category=self.theft, status=self.resolved, description="Resolved case"
        )
        Report.objects.create(
            category=self.theft, status=self.submitted, description="Still under review"
        )
        flagged = Report.objects.create(
            category=self.theft, status=self.resolved, description="Flagged", is_flagged=True
        )

        response = self.client.get(reverse("report-public"))
        self.assertEqual(response.status_code, 200)
        references = [row["reference_number"] for row in response.json()["data"]]
        self.assertIn(public_report.reference_number, references)
        self.assertNotIn(flagged.reference_number, references)
        self.assertEqual(len(references), 1)

    def test_public_response_never_exposes_internal_fields(self):
        Report.objects.create(category=self.theft, status=self.resolved, description="Public case")
        row = self.client.get(reverse("report-public")).json()["data"][0]
        for forbidden in ("access_key_hash", "is_flagged", "flag_reason", "assigned_investigator"):
            self.assertNotIn(forbidden, row)


class InvestigatorTests(BaseCase):
    """Stories 10, 11, 12 - reviewing, filtering, status and notes."""

    def setUp(self):
        super().setUp()
        self.auth(self.investigator)
        self.report = Report.objects.create(
            category=self.theft,
            status=self.submitted,
            description="A report to investigate",
            location_text="Uttara, Dhaka",
        )

    def test_investigator_can_list_reports(self):
        response = self.client.get(reverse("report-manage-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_investigator_can_list_assignable_staff(self):
        response = self.client.get(reverse("report-investigator-list"))
        self.assertEqual(response.status_code, 200)
        ids = [row["id"] for row in response.json()["data"]]
        self.assertIn(self.investigator.id, ids)
        self.assertIn(self.admin.id, ids)
        # The password hash is never part of the payload.
        self.assertNotIn("password", response.json()["data"][0])

    def test_investigator_can_filter_by_status(self):
        Report.objects.create(category=self.theft, status=self.resolved, description="Done")
        response = self.client.get(reverse("report-manage-list"), {"status": "resolved"})
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["data"][0]["status_slug"], "resolved")

    def test_investigator_can_filter_by_category_and_location(self):
        Report.objects.create(category=self.assault, status=self.submitted, description="Other")
        by_category = self.client.get(reverse("report-manage-list"), {"category": self.theft.id})
        self.assertEqual(by_category.json()["count"], 1)
        by_location = self.client.get(reverse("report-manage-list"), {"location": "Uttara"})
        self.assertEqual(by_location.json()["count"], 1)

    def test_status_update_writes_status_history(self):
        response = self.client.patch(
            reverse("report-status-update", args=[self.report.id]),
            {"status_id": self.review.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status_id, self.review.id)
        history = self.report.status_history.all()
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().old_status_id, self.submitted.id)
        self.assertEqual(history.first().new_status_id, self.review.id)
        self.assertEqual(history.first().changed_by_id, self.investigator.id)

    def test_status_update_can_assign_investigator(self):
        response = self.client.patch(
            reverse("report-status-update", args=[self.report.id]),
            {"status_id": self.review.id, "assigned_investigator_id": self.other_investigator.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.assigned_investigator_id, self.other_investigator.id)

    def test_investigator_can_add_note(self):
        response = self.client.post(
            reverse("report-notes", args=[self.report.id]),
            {"note_text": "Witness statement taken from the nearby shop."},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.report.notes.count(), 1)
        note = self.report.notes.first()
        self.assertEqual(note.investigator_id, self.investigator.id)

    def test_investigator_can_list_notes(self):
        self.client.post(
            reverse("report-notes", args=[self.report.id]),
            {"note_text": "First contact"},
            format="json",
        )
        response = self.client.get(reverse("report-notes", args=[self.report.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["data"]), 1)

    def test_investigator_can_upload_evidence_to_existing_report(self):
        upload = SimpleUploadedFile("clip.mp4", b"\x00\x00\x00\x18ftypmp42", content_type="video/mp4")
        response = self.client.post(
            reverse("report-evidence", args=[self.report.id]),
            {"evidence_files": [upload]},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.report.evidence.count(), 1)

    def test_detail_includes_notes_history_and_evidence(self):
        response = self.client.get(reverse("report-manage-detail", args=[self.report.id]))
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        for key in ("evidence", "notes", "status_history"):
            self.assertIn(key, data)


class AdminTests(BaseCase):
    """Stories 13, 14, 15, 16, 17 - administration."""

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        self.report = Report.objects.create(
            category=self.theft, status=self.submitted, description="Admin visible"
        )

    def test_admin_can_create_category(self):
        response = self.client.post(
            reverse("admin-category-list"), {"name": "Cyber Crime", "description": "Online crime"}
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(CrimeCategory.objects.filter(name="Cyber Crime").exists())

    def test_admin_can_update_and_delete_category(self):
        response = self.client.patch(
            reverse("admin-category-detail", args=[self.assault.id]),
            {"name": "Physical Assault", "description": "Updated", "is_active": True},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(CrimeCategory.objects.get(pk=self.assault.id).description, "Updated")

        response = self.client.delete(reverse("admin-category-detail", args=[self.assault.id]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(CrimeCategory.objects.filter(pk=self.assault.id).exists())

    def test_category_in_use_is_deactivated_not_deleted(self):
        response = self.client.delete(reverse("admin-category-detail", args=[self.theft.id]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(CrimeCategory.objects.get(pk=self.theft.id).is_active)

    def test_admin_can_create_investigator_account(self):
        response = self.client.post(
            reverse("admin-user-list"),
            {
                "email": "newinv@test.com",
                "password": "StrongPass#123",
                "full_name": "New Investigator",
                "role": Role.INVESTIGATOR,
            },
        )
        self.assertEqual(response.status_code, 201)
        created = User.objects.get(email="newinv@test.com")
        self.assertEqual(created.role, Role.INVESTIGATOR)
        self.assertNotEqual(created.password, "StrongPass#123")

    def test_admin_can_disable_an_account(self):
        response = self.client.patch(
            reverse("admin-user-detail", args=[self.investigator.id]),
            {"full_name": self.investigator.full_name, "role": Role.INVESTIGATOR, "is_active": False},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.get(pk=self.investigator.id).is_active)

    def test_admin_can_flag_and_unflag_report(self):
        response = self.client.patch(
            reverse("admin-report-flag", args=[self.report.id]),
            {"is_flagged": True, "flag_reason": "Duplicate of an existing case."},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertTrue(self.report.is_flagged)
        self.assertEqual(self.report.flag_reason, "Duplicate of an existing case.")

        response = self.client.patch(
            reverse("admin-report-flag", args=[self.report.id]),
            {"is_flagged": False, "flag_reason": ""},
            format="json",
        )
        self.report.refresh_from_db()
        self.assertFalse(self.report.is_flagged)

    def test_flagging_requires_a_reason(self):
        response = self.client.patch(
            reverse("admin-report-flag", args=[self.report.id]),
            {"is_flagged": True, "flag_reason": ""},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_statistics_are_returned(self):
        response = self.client.get(reverse("admin-statistics"))
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["total_reports"], 1)
        self.assertEqual(data["flagged_reports"], 0)
        self.assertIn("by_status", data)
        self.assertIn("by_category", data)
        self.assertIn("top_locations", data)

    def test_admin_can_manage_emergency_contacts(self):
        response = self.client.post(
            reverse("admin-emergency-contact-list"),
            {"name": "Ambulance", "phone": "999", "description": "Medical help"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(EmergencyContact.objects.filter(name="Ambulance").exists())

    def test_admin_can_manage_guidelines(self):
        response = self.client.post(
            reverse("admin-guideline-list"),
            {"title": "Stay visible", "content": "Use well lit routes."},
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(SafetyGuideline.objects.filter(title="Stay visible").exists())

    def test_admin_can_manage_settings(self):
        response = self.client.post(
            reverse("admin-setting-list"),
            {"setting_key": "site_name", "setting_value": "SafeVoice"},
        )
        self.assertIn(response.status_code, (201, 400))
        self.assertTrue(SystemSetting.objects.filter(setting_key="site_name").exists())


class PermissionTests(BaseCase):
    """Access control - the admin surface must not be reachable by anyone else."""

    def test_anonymous_cannot_reach_manage_endpoints(self):
        for name in ("report-manage-list", "admin-report-list", "admin-statistics"):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 401, f"{name} should require auth")

    def test_investigator_cannot_reach_admin_endpoints(self):
        self.auth(self.investigator)
        for name in ("admin-report-list", "admin-statistics", "admin-category-list"):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 403, f"{name} should require admin role")

    def test_investigator_cannot_flag_reports(self):
        self.auth(self.investigator)
        report = Report.objects.create(category=self.theft, status=self.submitted, description="x")
        response = self.client.patch(
            reverse("admin-report-flag", args=[report.id]),
            {"is_flagged": True, "flag_reason": "nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_investigator_cannot_create_users(self):
        self.auth(self.investigator)
        response = self.client.post(
            reverse("admin-user-list"),
            {
                "email": "sneaky@test.com",
                "password": "StrongPass#123",
                "full_name": "Sneaky",
                "role": Role.ADMIN,
            },
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(email="sneaky@test.com").exists())

    def test_anonymous_cannot_update_status(self):
        report = Report.objects.create(category=self.theft, status=self.submitted, description="x")
        response = self.client.patch(
            reverse("report-status-update", args=[report.id]),
            {"status_id": self.review.id},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_cannot_delete_own_account(self):
        self.auth(self.admin)
        response = self.client.delete(reverse("admin-user-detail", args=[self.admin.id]))
        self.assertEqual(response.status_code, 400)


class AuthenticationTests(BaseCase):
    """Login, logout and session handling."""

    def test_login_returns_token_and_profile(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": "inv@test.com", "password": "InvPass#123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["token"])
        self.assertEqual(body["user"]["role"], Role.INVESTIGATOR)

    def test_login_with_wrong_password_fails(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": "inv@test.com", "password": "nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_disabled_account_cannot_log_in(self):
        User.objects.filter(email="inv@test.com").update(is_active=False)
        response = self.client.post(
            reverse("auth-login"),
            {"email": "inv@test.com", "password": "InvPass#123"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_logout_invalidates_the_token(self):
        token = self.auth(self.investigator)
        response = self.client.post(reverse("auth-logout"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_me_returns_the_current_profile(self):
        self.auth(self.investigator)
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["email"], "inv@test.com")


class PublicResourceTests(BaseCase):
    """Stories 7, 18, 19 - emergency contacts and safety guidance."""

    def test_emergency_contacts_are_public(self):
        EmergencyContact.objects.create(name="Police", phone="999", description="Help")
        response = self.client.get(reverse("emergency-contacts"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_guidelines_are_public(self):
        SafetyGuideline.objects.create(title="Stay safe", content="Use lit routes.")
        response = self.client.get(reverse("guidelines"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_categories_are_public(self):
        response = self.client.get(reverse("category-list"))
        self.assertEqual(response.status_code, 200)
        names = [row["name"] for row in response.json()["data"]]
        self.assertIn("Theft", names)
        self.assertIn("Physical Assault", names)
