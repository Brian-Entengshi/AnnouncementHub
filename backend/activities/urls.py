from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register("activities", views.ActivityViewSet, basename="activities")
urlpatterns = router.urls
