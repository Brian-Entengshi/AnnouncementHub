from urllib.parse import urlsplit
from rest_framework import serializers
from .models import UsefulLink


class PublicLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsefulLink
        fields = ("id", "title", "description", "url", "category")


class LinkSerializer(PublicLinkSerializer):
    class Meta(PublicLinkSerializer.Meta):
        fields = (*PublicLinkSerializer.Meta.fields, "is_public")

    def validate_url(self, value):
        parts = urlsplit(value)
        if parts.scheme.lower() not in ("https", "http") or not parts.hostname:
            raise serializers.ValidationError("Use a full HTTP or HTTPS address.")
        if parts.username is not None or parts.password is not None:
            raise serializers.ValidationError(
                "Remove the sign-in credentials from this URL."
            )
        return value

    def validate(self, attrs):
        # Validate the stored destination as well when publishing an existing link.
        if self.instance and attrs.get("is_public") and "url" not in attrs:
            try:
                url = self.fields["url"].run_validation(self.instance.url)
                self.validate_url(url)
            except serializers.ValidationError as error:
                raise serializers.ValidationError({"url": error.detail}) from error
        return attrs
