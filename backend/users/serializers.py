from teams.models import CORE_TEAM_NAMES
from rest_framework import serializers
from .models import User


class AccountSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="first_name", max_length=150)
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )
    team_name = serializers.StringRelatedField(source="team", read_only=True)
    can_change_status = serializers.SerializerMethodField()

    def get_can_change_status(self, target):
        request = self.context.get("request")
        return bool(
            request and not target.is_superuser and request.user.pk != target.pk
        )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "position",
            "team",
            "team_name",
            "contact",
            "is_active",
            "password",
            "must_change_password",
            "date_joined",
            "can_change_status",
        )
        read_only_fields = ("must_change_password", "date_joined")

    def validate(self, attrs):
        actor = self.context["request"].user
        target = self.instance
        role = attrs.get("role", getattr(target, "role", None))
        if role not in ("staff", "officer", "adviser"):
            raise serializers.ValidationError({"role": "Choose an account role."})
        if (not target or role != target.role) and role == "adviser":
            raise serializers.ValidationError(
                {"role": "Provision advisers using createsuperuser."}
            )
        if not (actor.is_superuser or actor.role == "adviser") and (
            role != "staff" or target and target.role != "staff"
        ):
            raise serializers.ValidationError(
                {"role": "Officers can only manage staff."}
            )
        if (
            target
            and (target.is_superuser or target.pk == actor.pk)
            and (role != target.role or not attrs.get("is_active", target.is_active))
        ):
            raise serializers.ValidationError(
                "This administrative account must stay active with its current role."
            )
        team = attrs.get("team", getattr(target, "team", None))
        if role != "staff":
            attrs["team"] = None
        elif not team or team.name not in CORE_TEAM_NAMES:
            raise serializers.ValidationError(
                {"team": "Assign this staff member to one of the four core teams."}
            )
        if not target and not attrs.get("password"):
            raise serializers.ValidationError(
                {"password": "An initial password is required."}
            )
        # A blank replacement is an ordinary profile edit. Retain all
        # non-empty input verbatim and validate permanent passwords separately.
        if target and attrs.get("password") == "":
            attrs.pop("password")
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            **validated_data,
            created_by=self.context["request"].user,
            must_change_password=True,
        )

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if password is not None:
            instance.set_password(password)
            instance.must_change_password = True
        return super().update(instance, validated_data)
