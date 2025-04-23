import insightface
import cv2
from PIL import Image
import io
import requests
import numpy as np
import os

model = insightface.app.FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
model.prepare(ctx_id=0)

EMBEDDING_DIR = "embeddings"


def get_all_embeddings(user_id):
    embeddings = []
    for file in os.listdir(EMBEDDING_DIR):
        if file.startswith(f"{user_id}_") and file.endswith(".npy"):
            vec = np.load(os.path.join(EMBEDDING_DIR, file))
            embeddings.append(vec)
    return embeddings


def verify_face(image_bytes: bytes, user_id: str = None, save_mode: bool = False, angle_index: int = None):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image)
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    faces = model.get(image_bgr)
    if not faces:
        return {"matched": False, "message": "ไม่พบใบหน้า"}

    detected_embedding = faces[0].embedding
    print(" detected_embedding.shape:", detected_embedding.shape)

    if save_mode and user_id:
        if angle_index is None:
            return {"status": "error", "message": "ไม่ระบุ angleIndex"}

        np.save(f"{EMBEDDING_DIR}/{user_id}_{angle_index}.npy", detected_embedding)

        try:
            requests.post(
                "http://localhost:5000/api/users/update-face-status",
                json={
                    "studentId": user_id,
                    "faceScanned": True
                },
                timeout=5
            )
        except Exception as e:
            print("❌ ไม่สามารถอัปเดต faceScanned ไปยัง Node ได้:", str(e))

        return {
            "saved": True,
            "userId": user_id,
            "studentId": user_id,
            "message": "บันทึกใบหน้าเรียบร้อยแล้ว",
        }

    if user_id:
        embeddings = get_all_embeddings(user_id)
        if not embeddings:
            return {"matched": False, "message": "ไม่พบข้อมูลใบหน้าของผู้ใช้"}

        avg_embedding = np.mean(embeddings, axis=0)

        print("📐 detected_embedding.shape:", detected_embedding.shape)
        print("📐 avg_embedding.shape:", avg_embedding.shape)

        distance = np.linalg.norm(detected_embedding - avg_embedding)
        matched = distance < 0.1

        return {
            "matched": matched,
            "distance": float(distance),
            "userId": user_id,
            "studentId": user_id,
            "message": "✅ ตรวจสอบสำเร็จ" if matched else "❌ ใบหน้าไม่ตรงกับที่ลงทะเบียนไว้",
        }

    return {
        "embedding": detected_embedding.tolist(),
        "message": "คืนค่า embedding สำเร็จ"
    }