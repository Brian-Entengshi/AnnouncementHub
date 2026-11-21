from django.utils import timezone
from rest_framework import serializers

from config.permissions import public_author
from .models import Notice, Venue


class VenueOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = ("id", "name")


class VenueSerializer(serializers.ModelSerializer):
    available = serializers.BooleanField(default=True)

    class Meta:
        model = Venue
        fields = "__all__"
        read_only_fields = ("archived",)

    def validate_name(self, value):
        name = value.strip()
        query = Venue.objects.filter(name__iexact=name)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError("A venue already uses this name.")
        return name

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "Enter a capacity of at least one person."
            )
        return value

    def validate(self, attrs):
        if self.instance and self.instance.archived and attrs.get("available"):
            raise serializers.ValidationError(
                {"available": "An archived venue cannot be made active."}
            )
        return attrs


def published_notices():
    return Notice.objects.filter(
        publication_status="published", venue__archived=False, venue__available=True
    )


class PublicNoticeSerializer(serializers.ModelSerializer):
    venue_name = serializers.CharField(source="venue_display_name", read_only=True)
    status = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = (
            "id",
            "title",
            "description",
            "venue",
            "venue_name",
            "starts_at",
            "ends_at",
            "published_at",
            "status",
            "author_name",
        )

    def get_status(self, obj):
        now = timezone.now()
        if obj.ends_at <= now:
            return "expired"
        return "upcoming" if obj.starts_at > now else "current"

    def get_author_name(self, obj):
        return public_author(obj.author)


class NoticeSerializer(PublicNoticeSerializer):
    class Meta:
        model = Notice
        fields = (*PublicNoticeSerializer.Meta.fields, "publication_status")
        read_only_fields = ("published_at",)
        extra_kwargs = {"venue": {"required": True, "allow_null": False}}

    def validate(self, attrs):
        notice = self.instance
        start = attrs.get("starts_at", getattr(notice, "starts_at", None))
        end = attrs.get("ends_at", getattr(notice, "ends_at", None))
        if end <= start:
            raise serializers.ValidationError({"ends_at": "End must follow start."})
        venue = attrs.get("venue", getattr(notice, "venue", None))
        if not notice or "venue" in attrs and venue.pk != notice.venue_id:
            if venue is None or venue.archived or not venue.available:
                raise serializers.ValidationError({"venue": "Choose an active venue."})
        return attrs
