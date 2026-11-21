from rest_framework import serializers
from users.serializers import TeamMemberSerializer
from .models import CORE_TEAM_NAMES, Team


class TeamInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ("id", "name", "description")


class TeamSerializer(TeamInfoSerializer):
    member_count = serializers.SerializerMethodField()
    is_core = serializers.SerializerMethodField()

    def get_member_count(self, team):
        if hasattr(team, "member_count"):
            return team.member_count
        return team.staff_members.filter(role="staff").count()

    def get_is_core(self, team):
        return team.name in CORE_TEAM_NAMES

    class Meta(TeamInfoSerializer.Meta):
        fields = (
            *TeamInfoSerializer.Meta.fields,
            "is_active",
            "is_core",
            "member_count",
        )


class StaffRosterSerializer(TeamMemberSerializer):
    class Meta(TeamMemberSerializer.Meta):
        fields = ("id", "full_name", "position")
