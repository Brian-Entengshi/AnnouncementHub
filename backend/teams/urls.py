from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register("teams", views.TeamViewSet, basename="teams")
urlpatterns = router.urls
