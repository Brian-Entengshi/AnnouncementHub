from django.db import models


class HubSettings(models.Model):
    contact_email = models.EmailField(blank=True)
    office_hours = models.CharField(max_length=160, blank=True)
