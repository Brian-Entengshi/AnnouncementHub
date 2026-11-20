from django.utils import timezone
from rest_framework import serializers
from config.uploads import ValidatedUploads
from .models import Activity


class ActivitySerializer(ValidatedUploads):
    status = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = "__all__"

    def get_status(self, obj):
        today = timezone.localdate()
        if obj.start_date > today:
            return "upcoming"
        return "completed" if obj.end_date < today else "ongoing"

    def validate(self, attrs):
        if attrs.get("end_date", getattr(self.instance, "end_date", None)) < attrs.get(
            "start_date", getattr(self.instance, "start_date", None)
        ):
            raise serializers.ValidationError(
                {"end_date": "Select an end date on or after the start date."}
            )
        return attrs
