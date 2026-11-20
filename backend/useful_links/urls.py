from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register("links", views.LinkViewSet, basename="links")
urlpatterns = router.urls
