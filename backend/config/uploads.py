from pathlib import Path
from rest_framework import serializers


IMAGE_EXTENSIONS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def validate_public_image(value):
    if value and (
        value.size > 5 * 1024 * 1024 or value.image.format not in IMAGE_EXTENSIONS
    ):
        raise serializers.ValidationError(
            "Upload a JPEG, PNG or WebP image of up to 5 MB."
        )
    return value


class ValidatedUploads(serializers.ModelSerializer):
    def validate_image(self, value):
        return validate_public_image(value)

    def validate_attachment(self, value):
        if value:
            signature = value.read(5)
            value.seek(0)
            if (
                value.size > 5 * 1024 * 1024
                or Path(value.name).suffix.lower() != ".pdf"
                or signature != b"%PDF-"
            ):
                raise serializers.ValidationError("Upload a PDF of up to 5 MB.")
        return value
