from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from django.contrib.auth.models import User
import pandas as pd

from .models import CustomDataset, Experiment
from .serializers import UserSerializer, CustomDatasetSerializer, ExperimentSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class CustomDatasetViewSet(viewsets.ModelViewSet):
    serializer_class = CustomDatasetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomDataset.objects.filter(user=self.request.user).order_by('-uploaded_at')

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('csv_file')
        name = request.data.get('name')
        if not file_obj or not name:
            return Response({"error": "Name and csv_file are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            df = pd.read_csv(file_obj)
            # Find target column
            target_col = None
            for col in ['target', 'label', 'y']:
                if col in [c.lower() for c in df.columns]:
                    target_col = df.columns[[c.lower() for c in df.columns].index(col)]
                    break
            
            if not target_col:
                target_col = df.columns[-1] # fallback to last column
            
            features = [c for c in df.columns if c != target_col]
            feature_count = len(features)
            class_count = df[target_col].nunique()
            
            # Reattach the file before saving
            dataset = CustomDataset(
                user=request.user,
                name=name,
                feature_count=feature_count,
                class_count=class_count
            )
            # Cannot reuse the exact file_obj after pandas read, wait pandas read takes the file
            # Actually pandas might seek to bottom. Let's reset stream.
            file_obj.seek(0)
            dataset.csv_file = file_obj
            dataset.save()

            serializer = self.get_serializer(dataset)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Invalid CSV file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class ExperimentViewSet(viewsets.ModelViewSet):
    serializer_class = ExperimentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Experiment.objects.filter(user=self.request.user).order_by('-run_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
