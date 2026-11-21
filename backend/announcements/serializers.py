from rest_framework import serializers
from config.permissions import public_author
from config.uploads import ValidatedUploads
from .models import Announcement


class AnnouncementSerializer(ValidatedUploads):
    author_name = serializers.StringRelatedField(source="author")

    class Meta:
        model = Announcement
        fields = "__all__"
        read_only_fields = ("author", "published_at")


class PublicAnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = (
            "id",
            "title",
            "description",
            "category",
            "author_name",
            "pinned",
            "published_at",
            "image",
            "attachment",
        )

    def get_author_name(self, obj):
        return public_author(obj.author)
