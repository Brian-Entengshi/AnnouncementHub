from django.utils import timezone
from rest_framework import serializers
from reservations.models import Reservation
from reservations.services import local_instant
from .models import Notice, Venue


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = "__all__"

    def validate(self, attrs):
        if self.instance:
            booked = self.instance.reservations.filter(
                status="approved", date__gte=timezone.localdate()
            )
            if booked.exists() and (
                attrs.get("available") is False
                or booked.filter(
                    attendees__gt=attrs.get("capacity", self.instance.capacity)
                ).exists()
            ):
                raise serializers.ValidationError(
                    "Resolve affected approved bookings before changing venue availability or capacity."
                )
        if attrs.get("capacity", 1) < 1:
            raise serializers.ValidationError(
                {"capacity": "Capacity must be positive."}
            )
        return attrs


class NoticeSerializer(serializers.ModelSerializer):
    venue_name = serializers.StringRelatedField(source="venue")

    class Meta:
        model = Notice
        fields = "__all__"

    def validate(self, attrs):
        def value(name):
            return attrs.get(name, getattr(self.instance, name, None))

        start, end = value("starts_at"), value("ends_at")
        if end <= start:
            raise serializers.ValidationError({"ends_at": "End must follow start."})
        if value("blocks_bookings"):
            bookings = Reservation.objects.filter(
                venue=value("venue"),
                status="approved",
                date__range=(
                    timezone.localtime(start).date(),
                    timezone.localtime(end).date(),
                ),
            )
            if any(
                local_instant(b.date, b.end) > start
                and local_instant(b.date, b.start) < end
                for b in bookings
            ):
                raise serializers.ValidationError(
                    "Resolve overlapping approved bookings before publishing this closure."
                )
        return attrs
