from django.contrib import admin
from config.admin import RecordsAdmin
from .models import Reservation, StatusChange

admin.site.register(Reservation, RecordsAdmin)
admin.site.register(StatusChange, RecordsAdmin)
