from django.utils import timezone
from rest_framework import serializers
from reservations.models import Reservation
from reservations.services import local_instant
from .models import Notice, Venue


class VenueSerializer(serializers.ModelSerializer):
    available = serializers.BooleanField(default=True)

    class Meta:
        model = Venue
        fields = "__all__"
        read_only_fields = ("archived",)

    def validate_name(self, name):
        venues = Venue.objects.filter(name__iexact=name)
        if self.instance:
            venues = venues.exclude(pk=self.instance.pk)
        if venues.exists():
            raise serializers.ValidationError("A venue with this name already exists.")
        return name

    def validate(self, attrs):
        if self.instance and self.instance.archived and attrs.get("available"):
            raise serializers.ValidationError({"available": "This venue is archived."})
        if self.instance and "capacity" in attrs:
            if self.instance.reservations.filter(
                status="approved",
                date__gte=timezone.localdate(),
                attendees__gt=attrs["capacity"],
            ).exists():
                raise serializers.ValidationError(
                    {
                        "capacity": "The new capacity is below attendance for an approved booking."
                    }
                )
        if attrs.get("capacity", 1) < 1:
            raise serializers.ValidationError(
                {"capacity": "Capacity must be positive."}
            )
        return attrs


class NoticeSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source="venue_display_name", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        exclude = ("venue_snapshot",)
        extra_kwargs = {"venue": {"required": True, "allow_null": False}}

    def get_status(self, obj):
        now = timezone.now()
        if obj.ends_at <= now:
            return "expired"
        return "upcoming" if obj.starts_at > now else "current"

    def validate(self, attrs):
        def value(name):
            return attrs.get(name, getattr(self.instance, name, None))

        venue = value("venue")
        if venue is not None and value("blocks_bookings"):
            venue = Venue.objects.select_for_update().filter(pk=venue.pk).first()
        if venue is None:
            raise serializers.ValidationError(
                {"venue": "This notice belongs to a retired venue."}
            )
        if venue.archived and (
            self.instance is None or venue.pk != self.instance.venue_id
        ):
            raise serializers.ValidationError({"venue": "This venue is archived."})

        start, end = value("starts_at"), value("ends_at")
        if end <= start:
            raise serializers.ValidationError({"ends_at": "End must follow start."})
        if value("blocks_bookings"):
            bookings = Reservation.objects.filter(
                venue=venue,
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
