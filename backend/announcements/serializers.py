from rest_framework import serializers
from config.uploads import ValidatedUploads
from .models import Announcement


class AnnouncementSerializer(ValidatedUploads):
    author_name = serializers.StringRelatedField(source="author")

    class Meta:
        model = Announcement
        fields = "__all__"
        read_only_fields = ("author", "published_at")
