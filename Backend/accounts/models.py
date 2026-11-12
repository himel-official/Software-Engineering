"""Staff accounts for SafeVoice.

Maps to the ERD table USER. Citizens and guests are anonymous and therefore
have no account row at all - only investigators and administrators do.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    INVESTIGATOR = "INVESTIGATOR", "Investigator"
    ADMIN = "ADMIN", "Admin"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, full_name, role, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(
            email=email,
            full_name=full_name,
            role=role,
            **extra_fields,
        )
        # Django stores the password hash in the `password` column, which is the
        # ERD's `password_hash` column.
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, full_name="", role=Role.INVESTIGATOR, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, full_name, role, **extra_fields)

    def create_superuser(self, email, password=None, full_name="", **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        role = extra_fields.pop("role", Role.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        return self._create_user(email, password, full_name, role, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """ERD: USER"""

    # ERD column names use <entity>_id for primary keys.
    id = models.BigAutoField(primary_key=True, db_column="user_id")
    email = models.EmailField(max_length=150, unique=True)
    full_name = models.CharField(max_length=100)
    password = models.CharField(max_length=255, db_column="password_hash")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.INVESTIGATOR)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Django framework fields (not part of the domain ERD).
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "user"
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def save(self, *args, **kwargs):
        # Anyone with the ADMIN role may sign in to the Django admin site.
        if self.role == Role.ADMIN:
            self.is_staff = True
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == Role.ADMIN or self.is_superuser

    @property
    def is_investigator(self):
        return self.role == Role.INVESTIGATOR
