from rest_framework import serializers
from .models import Team


class TeamSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = "__all__"

    def get_members(self, obj):
        return [
            {"name": str(member), "position": member.position}
            for member in obj.members.all()
            if member.is_active and member.role == "staff"
        ]
