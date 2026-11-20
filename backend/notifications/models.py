from django.conf import settings
from django.db import models


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="notifications", on_delete=models.CASCADE
    )
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=160)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]

    @classmethod
    def broadcast(cls, message, link):
        from users.models import User

        cls.objects.bulk_create(
            [
                cls(recipient_id=pk, message=message, link=link)
                for pk in User.objects.filter(is_active=True).values_list(
                    "pk", flat=True
                )
            ]
        )
