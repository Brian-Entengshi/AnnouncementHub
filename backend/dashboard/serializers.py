import re
from urllib.parse import urlsplit
from uuid import uuid4

from rest_framework import serializers

from config.uploads import IMAGE_EXTENSIONS, validate_public_image

from .models import HubSettings


class PublicOrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HubSettings
        fields = (
            "hero_heading",
            "hero_welcome",
            "hero_description",
            "hero_cta_label",
            "hero_cta_section",
            "hero_image",
            "hero_image_alt",
            "about_heading",
            "about_intro",
            "about_description",
            "about_purpose",
            "about_mission",
            "about_vision",
            "contact_heading",
            "contact_intro",
            "contact_email",
            "contact_phone",
            "office_location",
            "office_hours",
            "facebook_url",
            "instagram_url",
            "website_url",
            "highlight_pinned",
            "announcement_page_size",
        )
        read_only_fields = fields


class SettingsSerializer(PublicOrganizationSerializer):
    hero_image = serializers.ImageField(required=False, allow_null=True)
    remove_hero_image = serializers.BooleanField(required=False, write_only=True)

    class Meta(PublicOrganizationSerializer.Meta):
        fields = PublicOrganizationSerializer.Meta.fields + ("remove_hero_image",)
        read_only_fields = ()

    def validate_contact_phone(self, value):
        if value and (
            not re.fullmatch(r"\+?[0-9 ().-]+", value)
            or not 7 <= sum(char.isdigit() for char in value) <= 15
        ):
            raise serializers.ValidationError(
                "Enter a phone number with 7 to 15 digits."
            )
        return value

    def validate_hero_image(self, value):
        validate_public_image(value)
        if value:
            value.name = uuid4().hex + IMAGE_EXTENSIONS[value.image.format]
        return value

    def validate(self, attrs):
        for field in ("facebook_url", "instagram_url", "website_url"):
            if url := attrs.get(field):
                parts = urlsplit(url)
                if (
                    parts.scheme not in ("http", "https")
                    or parts.username
                    or parts.password
                ):
                    raise serializers.ValidationError(
                        {field: "Enter a public HTTP or HTTPS URL."}
                    )
        if attrs.pop("remove_hero_image", False):
            if attrs.get("hero_image") is not None:
                raise serializers.ValidationError(
                    {
                        "hero_image": "Remove the image or upload a replacement in the same save."
                    }
                )
            attrs["hero_image"] = None
        return attrs
