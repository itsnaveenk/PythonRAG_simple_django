from django.urls import path
from core import views
from django.conf import settings
from django.views.generic import TemplateView

urlpatterns = [
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('upload/', TemplateView.as_view(template_name='upload.html'), name='upload_page'),
    path('query/', TemplateView.as_view(template_name='query.html'), name='query_page'),
    path('api/upload/', views.upload_view, name='upload'),
    path('api/query/', views.query_view, name='query'),
    path('api/documents/', views.documents_view, name='documents'), # New URL for listing documents
]
