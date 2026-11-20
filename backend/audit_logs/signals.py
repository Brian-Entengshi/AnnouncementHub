"""Record Django admin authentication. Hub API endpoints audit explicitly."""

from django.contrib.auth.signals import (
    user_logged_in,
    user_logged_out,
    user_login_failed,
)
from django.dispatch import receiver
from .models import AuditLog


def is_admin_auth(request):
    return request is not None and request.path_info.startswith("/admin/")


@receiver(user_logged_in)
def login_record(sender, request, user, **kwargs):
    if is_admin_auth(request):
        AuditLog.authentication(user, "LOGIN")


@receiver(user_logged_out)
def logout_record(sender, request, user, **kwargs):
    if is_admin_auth(request) and user and user.is_authenticated:
        AuditLog.authentication(user, "LOGOUT")


@receiver(user_login_failed)
def failed_login_record(sender, request, **kwargs):
    if is_admin_auth(request):
        AuditLog.authentication(None, "FAILED_LOGIN")
