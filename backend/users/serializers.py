from rest_framework import serializers
from teams.models import Team
from .models import User


class AssignedTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ("id", "name", "is_active")


class TeamMemberSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name")

    class Meta:
        model = User
        fields = ("id", "full_name", "username", "position", "is_active", "date_joined")


class AccountSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="first_name", max_length=150)
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )
    teams = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Team.objects.all(), required=False
    )
    assigned_teams = AssignedTeamSerializer(source="teams", many=True, read_only=True)
    can_change_status = serializers.SerializerMethodField()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["full_name"] = instance.get_full_name()
        return data

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
            "teams",
            "assigned_teams",
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
        assigned = {team.pk for team in target.teams.all()} if target else set()
        teams = attrs.get("teams")
        if role != "staff":
            attrs["teams"] = []
        elif teams is None:
            if not assigned:
                raise serializers.ValidationError(
                    {"teams": "Choose at least one team."}
                )
        else:
            if not teams:
                raise serializers.ValidationError(
                    {"teams": "Choose at least one team."}
                )
            if len({team.pk for team in teams}) != len(teams):
                raise serializers.ValidationError(
                    {"teams": "Select each team only once."}
                )
            if any(not team.is_active and team.pk not in assigned for team in teams):
                raise serializers.ValidationError(
                    {"teams": "Choose active teams for new assignments."}
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
        if instance.last_name and "first_name" in validated_data:
            name = validated_data.pop("first_name")
            if name != instance.get_full_name():
                first, separator, last = name.rpartition(" ")
                validated_data["first_name"] = first if separator else name
                validated_data["last_name"] = last if separator else ""
        password = validated_data.pop("password", None)
        if password is not None:
            instance.set_password(password)
            instance.must_change_password = True
        return super().update(instance, validated_data)
