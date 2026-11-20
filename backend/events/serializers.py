from django.utils import timezone
from rest_framework import serializers
from reservations.services import local_instant
from config.uploads import ValidatedUploads
from .models import Event


class EventSerializer(ValidatedUploads):
    date = serializers.DateField(source="reservation.date", read_only=True)
    start = serializers.TimeField(source="reservation.start", read_only=True)
    end = serializers.TimeField(source="reservation.end", read_only=True)
    venue_name = serializers.CharField(
        source="reservation.venue_display_name", read_only=True
    )
    retired_venue = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    activity_name = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = "__all__"

    def get_activity_name(self, obj):
        return obj.activity.title if obj.activity and obj.activity.published else None

    def get_retired_venue(self, obj):
        return obj.reservation.venue_id is None

    def get_status(self, obj):
        booking = obj.reservation
        if booking.status == "cancelled":
            return "cancelled"
        now = timezone.now()
        if local_instant(booking.date, booking.end) <= now:
            return "completed"
        return (
            "ongoing"
            if local_instant(booking.date, booking.start) <= now
            else "scheduled"
        )

    def validate(self, attrs):
        booking = attrs.get("reservation", getattr(self.instance, "reservation", None))
        if not self.instance or booking.pk != self.instance.reservation_id:
            venue = booking.venue
            if venue is None or venue.archived or not venue.available:
                raise serializers.ValidationError(
                    {"reservation": "Select an approved booking at an active venue."}
                )
        if booking.status != "approved" and not (
            self.instance
            and booking == self.instance.reservation
            and booking.status == "completed"
        ):
            raise serializers.ValidationError(
                {"reservation": "Select an approved reservation."}
            )
        return attrs
