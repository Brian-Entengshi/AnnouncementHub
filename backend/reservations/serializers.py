from rest_framework import serializers
from teams.models import Team
from .models import Reservation, StatusChange
from .services import check_slot


class HistorySerializer(serializers.ModelSerializer):
    actor = serializers.StringRelatedField()

    class Meta:
        model = StatusChange
        fields = ("actor", "status", "reason", "at")


class ReservationSerializer(serializers.ModelSerializer):
    requester_name = serializers.StringRelatedField(source="requester")
    team_name = serializers.StringRelatedField(source="team")
    venue_name = serializers.CharField(source="venue_display_name", read_only=True)
    history = HistorySerializer(many=True, read_only=True)

    class Meta:
        model = Reservation
        exclude = ("venue_snapshot",)
        read_only_fields = ("requester", "status")
        extra_kwargs = {
            "venue": {"required": True, "allow_null": False},
            "team": {"queryset": Team.objects.filter(is_active=True)},
        }

    def validate(self, attrs):
        check_slot(
            lock_venue=True,
            **{
                key: attrs[key]
                for key in ("venue", "date", "start", "end", "attendees")
            },
        )
        return attrs
