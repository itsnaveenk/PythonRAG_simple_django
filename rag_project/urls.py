from django.urls import path
from core import views

urlpatterns = [
    path('api/upload/', views.upload_view, name='upload'),
    path('api/query/', views.query_view, name='query'),
]
