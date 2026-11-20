from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register("announcements", views.AnnouncementViewSet, basename="announcements")
urlpatterns = router.urls
