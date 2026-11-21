from datetime import datetime

from django.utils import timezone
from rest_framework import serializers

from config.permissions import public_author
from config.uploads import ValidatedUploads
from .models import Event


class PublicEventSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source="venue_display_name", read_only=True)
    author_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "title",
            "description",
            "date",
            "start",
            "end",
            "venue",
            "venue_name",
            "author_name",
            "image",
            "status",
        )

    def get_status(self, obj):
        if obj.cancelled:
            return "cancelled"
        now = timezone.localtime().replace(tzinfo=None)
        if datetime.combine(obj.date, obj.end) <= now:
            return "completed"
        return (
            "ongoing" if datetime.combine(obj.date, obj.start) <= now else "scheduled"
        )

    def get_author_name(self, obj):
        return public_author(obj.author)


class EventSerializer(ValidatedUploads, PublicEventSerializer):
    activity_name = serializers.SerializerMethodField()
    retired_venue = serializers.SerializerMethodField()

    class Meta:
        model = Event
        exclude = ("venue_snapshot", "author")

    def get_retired_venue(self, obj):
        return obj.venue_id is None

    def get_activity_name(self, obj):
        return obj.activity.title if obj.activity and obj.activity.published else None

    def validate(self, attrs):
        event = self.instance
        start = attrs.get("start", getattr(event, "start", None))
        end = attrs.get("end", getattr(event, "end", None))
        if end <= start:
            raise serializers.ValidationError(
                {"end": "End time must be after the start time."}
            )
        venue = attrs.get("venue", getattr(event, "venue", None))
        if (
            not event
            or "venue" in attrs
            and (venue is None or venue.pk != event.venue_id)
        ):
            if venue is None or venue.archived or not venue.available:
                raise serializers.ValidationError({"venue": "Choose an active venue."})
        return attrs
