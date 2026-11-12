from django.contrib.auth import authenticate
from rest_framework import serializers

from accounts.models import Role, User


class UserSerializer(serializers.ModelSerializer):
    """Read serializer for a staff account (ERD: USER).

    The password hash is deliberately never sent to the client.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "password", "role", "is_active"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been disabled.")
        attrs["user"] = user
        return attrs
