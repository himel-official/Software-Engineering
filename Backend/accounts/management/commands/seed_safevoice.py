"""Seed the SafeVoice database with the lookup data the ERD expects.

Idempotent: safe to run repeatedly.

    python manage.py seed_safevoice
    python manage.py seed_safevoice --admin-password "strong-password"
    python manage.py seed_safevoice --with-demo-data
"""

import os
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from reports.models import CrimeCategory, Report, ReportStatus, StatusHistory
from resources.models import EmergencyContact, SafetyGuideline, SystemSetting

REPORT_STATUSES = [
    # (name, slug, description, is_public, order)
    ("Submitted", "submitted", "Report received and waiting for triage.", False, 1),
    ("Under Review", "under-review", "An investigator is reviewing the report.", False, 2),
    ("Investigating", "investigating", "Active investigation is in progress.", False, 3),
    ("Resolved", "resolved", "The incident has been resolved.", True, 4),
    ("Closed", "closed", "The case was closed without further action.", False, 5),
]

CRIME_CATEGORIES = [
    ("Theft", "Robbery, pickpocketing, shoplifting or stolen property."),
    ("Physical Assault", "Physical violence or attack against a person."),
    ("Verbal Harassment", "Threatening, abusive or intimidating speech."),
    ("Stalking", "Being repeatedly followed, watched or harassed."),
    ("Discrimination", "Harassment based on gender, religion, ethnicity or disability."),
    ("Unsafe Area", "Poor lighting, isolated roads or otherwise unsafe public spaces."),
    ("Accident", "Road, workplace or domestic accidents and injuries."),
    ("Cyber Crime", "Online harassment, fraud, scams or data misuse."),
    ("Other", "Anything that does not fit the categories above."),
]

EMERGENCY_CONTACTS = [
    ("National Emergency Service", "999", "Police, ambulance and fire service."),
    ("Police Control Room", "013", "Law enforcement assistance."),
    ("Fire Service", "955", "Fire and rescue emergencies."),
    ("Ambulance Service", "999", "Medical emergencies."),
    ("Women & Children Helpline", "1098", "Support for harassment or abuse."),
    ("National Cyber Security Helpline", "99000", "Report online crime and fraud."),
]

SAFETY_GUIDELINES = [
    (
        "Stay safe in unfamiliar places",
        "Stick to well-lit, populated routes whenever possible. Let someone know your "
        "expected journey and arrival time, and keep your phone charged and accessible.",
    ),
    (
        "What to do if you are being followed",
        "Enter a shop, cafe or building and speak to staff. Call the police and describe "
        "your location. Never confront the person following you directly.",
    ),
    (
        "Protect your identity when reporting",
        "Do not include your name, phone number or other identifying details in the "
        "description. Save the reference number and access key so you can track your "
        "report without revealing who you are.",
    ),
    (
        "Preserve evidence of a crime",
        "Take photos or videos from a safe distance, keep the original files with their "
        "timestamps, and note the exact time and location of what happened.",
    ),
    (
        "Emergency basics",
        "Keep emergency numbers saved in your phone, know the nearest police station, "
        "and leave the scene of a dangerous situation before seeking help.",
    ),
]

SYSTEM_SETTINGS = [
    ("public_visible_statuses", "resolved", "Comma separated status slugs visible to the public."),
    ("site_name", "SafeVoice", "Name shown in the browser title and header."),
    ("support_email", "support@safepath.app", "Contact address shown to users."),
    ("max_evidence_size_mb", "25", "Maximum size in megabytes for a single evidence file."),
]

# (category, status slug, days ago, location, description)
DEMO_REPORTS = [
    (
        "Theft",
        "resolved",
        3,
        "Dhanmondi 15, Dhaka",
        "A bag was taken from a seated passenger on a crowded bus. Route 6, near the "
        "Science Laboratory stop, in the early evening.",
    ),
    (
        "Verbal Harassment",
        "resolved",
        6,
        "Mirpur 10, Dhaka",
        "A group followed two colleagues home from the office and made threatening "
        "remarks outside the building gate for several evenings.",
    ),
    (
        "Unsafe Area",
        "resolved",
        9,
        "Kamalapur, Dhaka",
        "The footpath between the flyover and the rail line has no lighting after "
        "sunset, making the stretch difficult to walk safely.",
    ),
    (
        "Physical Assault",
        "investigating",
        1,
        "Uttara Sector 2, Dhaka",
        "An argument outside a shop escalated into a physical confrontation. Several "
        "witnesses are available and CCTV from a nearby pharmacy was requested.",
    ),
    (
        "Cyber Crime",
        "under-review",
        0,
        "Banani, Dhaka",
        "Repeated fraudulent calls claiming to be from a bank, asking for card and "
        "OTP details. Screenshots of the messages have been provided.",
    ),
    (
        "Discrimination",
        "submitted",
        0,
        "Farmgate, Dhaka",
        "Repeated inappropriate comments were made to a colleague during a team "
        "meeting. The reporting person asked for the incident to be handled quietly.",
    ),
]


class Command(BaseCommand):
    help = "Seed SafeVoice with default statuses, categories, contacts and guidelines."

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin-email",
            default=os.getenv("ADMIN_EMAIL", "admin@safepath.app"),
        )
        parser.add_argument(
            "--admin-password",
            default=os.getenv("ADMIN_PASSWORD", "SafeVoice#2026"),
        )
        parser.add_argument(
            "--admin-name",
            default=os.getenv("ADMIN_NAME", "SafeVoice Administrator"),
        )
        parser.add_argument(
            "--investigator-email",
            default=os.getenv("INVESTIGATOR_EMAIL", "investigator@safepath.app"),
        )
        parser.add_argument(
            "--investigator-password",
            default=os.getenv("INVESTIGATOR_PASSWORD", "Investigate#2026"),
        )
        parser.add_argument(
            "--with-demo-data",
            action="store_true",
            help="Also create a demo investigator account and a handful of sample reports.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self._seed_statuses()
        self._seed_categories()
        self._seed_contacts()
        self._seed_guidelines()
        self._seed_settings()
        self._seed_admin(options)
        self._seed_investigator(options)

        if options["with_demo_data"]:
            self._seed_demo_reports()

        self.stdout.write(self.style.SUCCESS("SafeVoice seed data is up to date."))

    def _seed_statuses(self):
        for name, slug, description, is_public, order in REPORT_STATUSES:
            ReportStatus.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "description": description,
                    "is_public": is_public,
                    "order": order,
                },
            )
        self.stdout.write(f"  statuses  : {ReportStatus.objects.count()}")

    def _seed_categories(self):
        for name, description in CRIME_CATEGORIES:
            CrimeCategory.objects.get_or_create(
                name=name, defaults={"description": description, "is_active": True}
            )
        self.stdout.write(f"  categories: {CrimeCategory.objects.count()}")

    def _seed_contacts(self):
        for name, phone, description in EMERGENCY_CONTACTS:
            EmergencyContact.objects.get_or_create(
                name=name, phone=phone, defaults={"description": description}
            )
        self.stdout.write(f"  contacts  : {EmergencyContact.objects.count()}")

    def _seed_guidelines(self):
        for title, content in SAFETY_GUIDELINES:
            SafetyGuideline.objects.get_or_create(title=title, defaults={"content": content})
        self.stdout.write(f"  guidelines: {SafetyGuideline.objects.count()}")

    def _seed_settings(self):
        for key, value, _description in SYSTEM_SETTINGS:
            SystemSetting.objects.get_or_create(setting_key=key, defaults={"setting_value": value})
        self.stdout.write(f"  settings  : {SystemSetting.objects.count()}")

    def _seed_admin(self, options):
        email = options["admin_email"]
        password = options["admin_password"]
        name = options["admin_name"]

        user = User.objects.filter(email=email).first()
        if user:
            self.stdout.write(f"  admin     : {email} already exists (left unchanged)")
            return

        User.objects.create_superuser(
            email=email, password=password, full_name=name, role=Role.ADMIN
        )
        self.stdout.write(self.style.SUCCESS(f"  admin     : created {email}"))

    def _seed_investigator(self, options):
        email = options["investigator_email"]
        password = options["investigator_password"]

        user = User.objects.filter(email=email).first()
        if user:
            self.stdout.write(f"  investigator: {email} already exists (left unchanged)")
            return

        User.objects.create_user(
            email=email,
            password=password,
            full_name="Demo Investigator",
            role=Role.INVESTIGATOR,
        )
        self.stdout.write(self.style.SUCCESS(f"  investigator: created {email}"))

    def _seed_demo_reports(self):
        """Create a few sample reports so the dashboard and map are not empty."""
        investigator = User.objects.filter(role=Role.INVESTIGATOR).first()
        created = 0

        for category_name, status_slug, days_ago, location, description in DEMO_REPORTS:
            if Report.objects.filter(description=description).exists():
                continue

            category = CrimeCategory.objects.filter(name=category_name).first()
            status = ReportStatus.objects.filter(slug=status_slug).first()
            if category is None or status is None:
                continue

            submitted_at = timezone.now() - timedelta(days=days_ago, hours=2)
            report = Report.objects.create(
                category=category,
                status=status,
                assigned_investigator=investigator if status_slug != "submitted" else None,
                description=description,
                incident_datetime=submitted_at,
                location_text=location,
                latitude="23.746100",
                longitude="90.375500",
                submitted_at=submitted_at,
            )
            StatusHistory.objects.create(
                report=report,
                changed_by=None,
                old_status=None,
                new_status=status,
            )
            created += 1

        self.stdout.write(f"  demo reports: {created} created ({Report.objects.count()} total)")
