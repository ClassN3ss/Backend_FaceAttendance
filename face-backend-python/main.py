from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from face_verify import verify_face

app = FastAPI()

# เปิดใช้งาน CORS สำหรับ frontend ที่ localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API สำหรับตรวจสอบใบหน้า
@app.post("/verify-face")
async def verify_face_api(
    file: UploadFile = File(...),
    userId: str = Form(...)
):
    print("📥 Received file:", file.filename)
    print("🧑‍🎓 Received userId:", userId)
    contents = await file.read()
    result = verify_face(contents, user_id=userId)
    return result

# API สำหรับบันทึกใบหน้า
@app.post("/upload-face")
async def upload_face_api(
    file: UploadFile = File(...),
    userId: str = Form(...)
):
    print("📤 Upload face file:", file.filename)
    print("👤 Saving face for userId:", userId)
    contents = await file.read()

    result = verify_face(contents, user_id=userId, save_mode=True)
    return {"message": "Face saved successfully", **result}
