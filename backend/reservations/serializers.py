from rest_framework import serializers
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
        extra_kwargs = {"venue": {"required": True, "allow_null": False}}

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role == "staff":
            attrs["team"] = user.team
        check_slot(
            **{
                key: attrs[key]
                for key in ("venue", "date", "start", "end", "attendees")
            }
        )
        return attrs
