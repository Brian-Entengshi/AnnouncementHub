from urllib.parse import urlsplit
from rest_framework import serializers
from .models import UsefulLink


class LinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsefulLink
        fields = "__all__"

    def validate_url(self, value):
        if urlsplit(value).scheme.lower() not in ("https", "http"):
            raise serializers.ValidationError("Use a full HTTP or HTTPS address.")
        return value
