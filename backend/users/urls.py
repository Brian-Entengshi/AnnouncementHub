from rest_framework.routers import SimpleRouter
from django.urls import path
from . import views

router = SimpleRouter()
router.register("accounts", views.AccountViewSet, basename="accounts")
urlpatterns = router.urls + [
    path("session/", views.session),
    path("login/", views.sign_in),
    path("logout/", views.sign_out),
    path("password/", views.password),
]
