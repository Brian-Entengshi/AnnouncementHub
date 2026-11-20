from rest_framework.routers import SimpleRouter
from django.urls import path
from . import views

router = SimpleRouter()
router.register("venues", views.VenueViewSet, basename="venues")
router.register("notices", views.NoticeViewSet, basename="notices")
urlpatterns = router.urls + [
    path("availability/", views.availability),
]
