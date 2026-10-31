"""Seed the database with the same demo dataset the React UI was built against.

Run with:

    flask --app run.py seed
    flask --app run.py seed --reset   # drop and recreate all tables first
"""

from datetime import date, datetime, time, timedelta

from werkzeug.security import generate_password_hash

from .extensions import db
from .models import (
    ActivityLog,
    Batch,
    Category,
    Counter,
    Inventory,
    Invoice,
    Medicine,
    Notification,
    Order,
    OrderEvent,
    OrderItem,
    Retailer,
    Role,
    StockMovement,
    Supplier,
    User,
)
from .utils import money

MEDICINE_SEED = [
    ("Paracetamol", "Panadol", "500 mg", "Tablet", "10 tablets x 10 strips", "Analgesic", 1.85, "MedCore Distributors"),
    ("Amoxicillin", "Moxicip", "500 mg", "Capsule", "10 capsules x 10 strips", "Antibiotic", 4.4, "Sunrise Pharma Ltd."),
    ("Ibuprofen", "Brufen", "400 mg", "Tablet", "10 tablets x 10 strips", "Analgesic", 2.15, "Sunrise Pharma Ltd."),
    ("Cetirizine", "Zyrtec", "10 mg", "Tablet", "10 tablets x 10 strips", "Antihistamine", 1.6, "Vertex Generics"),
    ("Azithromycin", "Azithral", "500 mg", "Tablet", "6 tablets x 5 strips", "Antibiotic", 6.9, "MedCore Distributors"),
    ("Metformin", "Glycomet", "500 mg", "Tablet", "10 tablets x 10 strips", "Antidiabetic", 2.75, "BlueLife Pharmaceuticals"),
    ("Amlodipine", "Amlokind", "5 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 3.2, "Aster Health Supply"),
    ("Atorvastatin", "Atorva", "10 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 4.95, "Aster Health Supply"),
    ("Omeprazole", "Prilosec", "20 mg", "Capsule", "10 capsules x 10 strips", "Gastrointestinal", 3.4, "Vertex Generics"),
    ("Pantoprazole", "Pan-40", "40 mg", "Tablet", "10 tablets x 10 strips", "Gastrointestinal", 3.85, "Vertex Generics"),
    ("Montelukast", "Montek", "10 mg", "Tablet", "10 tablets x 5 strips", "Respiratory", 8.6, "CuraNova India"),
    ("Salbutamol", "Ventolin", "100 mcg", "Inhaler", "1 inhaler x 200 doses", "Respiratory", 118.0, "CuraNova India"),
    ("Budesonide", "Pulmicort", "0.5 mg/2 ml", "Inhaler", "1 inhaler x 20 respules", "Respiratory", 214.5, "CuraNova India"),
    ("Loratadine", "Loratadine", "10 mg", "Tablet", "10 tablets x 10 strips", "Antihistamine", 1.35, "Vertex Generics"),
    ("Dextromethorphan", "Robitussin DM", "15 mg/5 ml", "Syrup", "100 ml bottle", "Respiratory", 42.0, "BlueLife Pharmaceuticals"),
    ("Ondansetron", "Emeset", "4 mg/2 ml", "Injection", "5 ampoules x 2 ml", "Gastrointestinal", 34.5, "BlueLife Pharmaceuticals"),
    ("Ceftriaxone", "Monocef", "1 g", "Injection", "1 vial x 10 vials", "Antibiotic", 96.0, "MedCore Distributors"),
    ("Prednisolone", "Deltasone", "10 mg", "Tablet", "10 tablets x 10 strips", "Respiratory", 4.1, "Sunrise Pharma Ltd."),
    ("Levocetirizine", "Xyzal", "5 mg", "Tablet", "10 tablets x 10 strips", "Antihistamine", 2.05, "Vertex Generics"),
    ("Losartan", "Losar", "50 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 3.6, "Aster Health Supply"),
    ("Clopidogrel", "Clopilet", "75 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 5.4, "Aster Health Supply"),
    ("Insulin Glargine", "Basalog", "100 IU/ml", "Injection", "3 pens x 3 ml", "Antidiabetic", 842.0, "CuraNova India"),
    ("Metronidazole", "Flagyl", "400 mg", "Tablet", "10 tablets x 10 strips", "Antibiotic", 2.9, "MedCore Distributors"),
    ("Ciprofloxacin", "Cipro", "500 mg", "Tablet", "10 tablets x 10 strips", "Antibiotic", 5.05, "MedCore Distributors"),
    ("Doxycycline", "Vibramycin", "100 mg", "Capsule", "10 capsules x 10 strips", "Antibiotic", 4.75, "MedCore Distributors"),
    ("Vitamin D3", "Calcirol", "1000 IU", "Capsule", "10 capsules x 10 strips", "Vitamins & Supplements", 3.25, "Vertex Generics"),
    ("Vitamin B12", "Methycobal", "1500 mcg", "Tablet", "10 tablets x 10 strips", "Vitamins & Supplements", 2.95, "Vertex Generics"),
    ("Calcium Carbonate", "Shelcal", "500 mg", "Tablet", "15 tablets x 10 strips", "Vitamins & Supplements", 2.4, "Vertex Generics"),
    ("Ferrous Sulphate", "Orofer XT", "325 mg", "Tablet", "10 tablets x 10 strips", "Vitamins & Supplements", 1.75, "Sunrise Pharma Ltd."),
    ("Folic Acid", "Folvite", "5 mg", "Tablet", "10 tablets x 10 strips", "Vitamins & Supplements", 1.2, "Sunrise Pharma Ltd."),
    ("Clotrimazole", "Canesten", "1%", "Ointment", "20 g tube", "Dermatology", 38.0, "BlueLife Pharmaceuticals"),
    ("Betamethasone", "Betnovate", "0.1%", "Ointment", "20 g tube", "Dermatology", 41.5, "BlueLife Pharmaceuticals"),
    ("Mometasone", "Elocon", "0.1%", "Ointment", "15 g tube", "Dermatology", 62.0, "CuraNova India"),
    ("Normal Saline", "NS 0.9%", "500 ml", "Drops", "1 bottle x 500 ml", "Respiratory", 28.0, "BlueLife Pharmaceuticals"),
    ("Oral Rehydration Salts", "Electral", "21.8 g", "Drops", "1 sachet x 10 sachets", "Gastrointestinal", 22.5, "Sunrise Pharma Ltd."),
    ("Oncologist - Imatinib", "Glivec", "400 mg", "Tablet", "10 tablets x 3 strips", "Oncology", 1280.0, "CuraNova India"),
    ("Allopurinol", "Zyloprim", "100 mg", "Tablet", "10 tablets x 10 strips", "Respiratory", 2.05, "Vertex Generics"),
    ("Levothyroxine", "Eltroxin", "50 mcg", "Tablet", "10 tablets x 10 strips", "Respiratory", 3.6, "BlueLife Pharmaceuticals"),
    ("Isosorbide Mononitrate", "Imdur", "30 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 3.35, "Aster Health Supply"),
    ("Ramipril", "Cardilol", "2.5 mg", "Tablet", "10 tablets x 10 strips", "Cardiovascular", 2.55, "Aster Health Supply"),
]

STOCK_SHAPE = [
    (3, 1840, 400), (2, 620, 300), (4, 96, 250), (2, 1420, 350), (2, 78, 200),
    (3, 760, 300), (2, 1205, 300), (3, 214, 250), (2, 980, 250), (2, 430, 200),
    (2, 62, 150), (3, 148, 120), (2, 88, 100), (2, 1340, 300), (2, 310, 150),
    (2, 46, 120), (2, 268, 150), (2, 715, 200), (2, 1090, 300), (3, 130, 200),
    (2, 540, 200), (2, 34, 80), (2, 690, 250), (2, 420, 200), (2, 585, 220),
    (3, 240, 200), (2, 1560, 400), (2, 880, 300), (3, 118, 200), (2, 2240, 400),
    (2, 905, 250), (2, 372, 180), (2, 240, 150), (2, 164, 120), (2, 205, 150),
    (2, 41, 150), (2, 640, 200), (2, 29, 60), (2, 498, 200), (2, 826, 220),
]

EXPIRY_OFFSETS = [
    (220, 405, 610), (150, 330), (28, 74, 190), (260, 480), (16, 55, 240),
    (190, 355, 520), (310, 470), (41, 96), (205, 430), (275, 505),
    (22, 68, 300), (360, 540), (12, 88, 210), (240, 450), (180, 395),
    (58, 160), (300, 520), (265, 480), (230, 425), (33, 120),
    (345, 560), (420, 640), (155, 340), (200, 410), (140, 305),
    (290, 495), (370, 580), (255, 460), (320, 540), (360, 600),
    (190, 380), (165, 350), (245, 470), (410, 600), (210, 430),
    (270, 505), (600, 820), (285, 490), (310, 540), (225, 455),
]

RETAILER_SEED = [
    ("RTL-01", "Apex Medical Retail", "Chennai", "S. Balaji", "+91 98400 11223"),
    ("RTL-02", "NovaCare Pharmacy Chain", "Bengaluru", "P. Nandini", "+91 99000 55412"),
    ("RTL-03", "Sunrise Drugstore", "Coimbatore", "M. Arun", "+91 97400 88310"),
    ("RTL-04", "GreenLeaf Pharmacy", "Madurai", "T. Kavitha", "+91 93800 66125"),
    ("RTL-05", "CityCare Medical Outlet", "Trichy", "R. Selvam", "+91 96770 23004"),
    ("RTL-06", "Sanjeevani Health Mart", "Salem", "A. Divya", "+91 90000 47718"),
    ("RTL-07", "Lotus Wellness Stores", "Pondicherry", "V. Kumar", "+91 94420 33990"),
    ("RTL-08", "MedPlus Junction", "Chennai", "D. Farah", "+91 90030 71145"),
]

ORDER_SEED = [
    ("ORD-2041", "Apex Medical Retail", 1, 6, "Delivered", 48620),
    ("ORD-2040", "NovaCare Pharmacy Chain", 0, 11, "Shipped", 214580),
    ("ORD-2039", "GreenLeaf Pharmacy", 2, 4, "Processing", 36840),
    ("ORD-2038", "Sunrise Drugstore", 1, 9, "Shipped", 412960),
    ("ORD-2037", "CityCare Medical Outlet", 3, 3, "Approved", 12450),
    ("ORD-2036", "MedPlus Junction", 0, 14, "Delivered", 289340),
    ("ORD-2035", "Sanjeevani Health Mart", 1, 7, "Pending", 97230),
    ("ORD-2034", "Lotus Wellness Stores", 4, 5, "Pending", 63880),
    ("ORD-2033", "Apex Medical Retail", 1, 8, "Delivered", 154720),
    ("ORD-2032", "NovaCare Pharmacy Chain", 2, 6, "Cancelled", 31290),
    ("ORD-2031", "GreenLeaf Pharmacy", 3, 10, "Delivered", 187450),
    ("ORD-2030", "Sunrise Drugstore", 5, 4, "Delivered", 27680),
    ("ORD-2029", "CityCare Medical Outlet", 6, 12, "Delivered", 241800),
    ("ORD-2028", "MedPlus Junction", 8, 5, "Delivered", 74320),
    ("ORD-2027", "Sanjeevani Health Mart", 9, 7, "Delivered", 118960),
    ("ORD-2026", "Lotus Wellness Stores", 11, 6, "Delivered", 88410),
    ("ORD-2025", "Apex Medical Retail", 12, 8, "Delivered", 196230),
    ("ORD-2024", "NovaCare Pharmacy Chain", 14, 5, "Delivered", 66370),
    ("ORD-2023", "GreenLeaf Pharmacy", 16, 9, "Delivered", 163740),
    ("ORD-2022", "Sunrise Drugstore", 18, 6, "Delivered", 104250),
    ("ORD-2021", "CityCare Medical Outlet", 20, 7, "Delivered", 129380),
    ("ORD-2020", "MedPlus Junction", 22, 8, "Delivered", 171620),
    ("ORD-2019", "Sanjeevani Health Mart", 24, 5, "Delivered", 79240),
    ("ORD-2018", "Lotus Wellness Stores", 26, 6, "Delivered", 94870),
]

STATUS_EVENTS = {
    "Pending": ["Order placed"],
    "Approved": ["Order placed", "Approved by distributor"],
    "Processing": ["Order placed", "Approved by distributor", "Picking started"],
    "Shipped": ["Order placed", "Approved by distributor", "Picking started", "Dispatched - AWB generated"],
    "Delivered": [
        "Order placed",
        "Approved by distributor",
        "Picking started",
        "Dispatched - AWB generated",
        "Delivered and confirmed",
    ],
    "Cancelled": ["Order placed", "Cancelled by retailer"],
}

MOVEMENT_SEED = [
    ("MOV-1", 1, "MED-001", "Paracetamol 500 mg", "Outbound", -240, "ORD-2041", "System (order fulfilment)"),
    ("MOV-2", 1, "MED-012", "Salbutamol Inhaler", "Inbound", 120, "GRN-882", "K. Iyer"),
    ("MOV-3", 2, "MED-003", "Ibuprofen 400 mg", "Adjustment", -12, "ADJ-114", "R. Menon (damaged units)"),
    ("MOV-4", 2, "MED-022", "Insulin Glargine", "Outbound", -36, "ORD-2038", "System (order fulfilment)"),
    ("MOV-5", 3, "MED-008", "Atorvastatin 10 mg", "Outbound", -180, "ORD-2036", "System (order fulfilment)"),
    ("MOV-6", 3, "MED-015", "Dextromethorphan Syrup", "Return", 24, "RET-041", "S. Rao"),
    ("MOV-7", 4, "MED-005", "Azithromycin 500 mg", "Outbound", -96, "ORD-2033", "System (order fulfilment)"),
    ("MOV-8", 5, "MED-027", "Vitamin D3 1000 IU", "Inbound", 500, "GRN-879", "K. Iyer"),
    ("MOV-9", 6, "MED-035", "Normal Saline 500 ml", "Outbound", -210, "ORD-2029", "System (order fulfilment)"),
    ("MOV-10", 7, "MED-013", "Budesonide Inhaler", "Outbound", -40, "ORD-2025", "System (order fulfilment)"),
]

ACTIVITY_SEED = [
    ("ACT-1", "order", "Order ORD-2041 delivered", "Apex Medical Retail - 6 items", 0, "System"),
    ("ACT-2", "inventory", "Low stock alert: Ibuprofen 400 mg", "Stock fell below reorder level (96 units)", 0, "Inventory monitor"),
    ("ACT-3", "approval", "Order ORD-2037 approved", "CityCare Medical Outlet - INR 12,450", 1, "K. Iyer"),
    ("ACT-4", "inventory", "Goods received GRN-882", "120 Salbutamol Inhaler units from CuraNova India", 1, "K. Iyer"),
    ("ACT-5", "order", "New order ORD-2034 received", "Lotus Wellness Stores - INR 63,880", 1, "Lotus Wellness Stores"),
    ("ACT-6", "alert", "Near-expiry batch expiring in 12 days", "Budesonide Inhaler - BATCH-4271 (88 units)", 2, "Expiry monitor"),
    ("ACT-7", "order", "Order ORD-2032 cancelled", "NovaCare Pharmacy Chain - stock unavailable", 2, "P. Nandini"),
    ("ACT-8", "inventory", "Stock adjustment ADJ-114", "Ibuprofen -12 units written off (damaged packaging)", 2, "R. Menon"),
]

NOTIFICATION_SEED = [
    ("N-1", "Stockout risk: Insulin Glargine", "Estimated 4 days of cover remaining", 0, "danger", False),
    ("N-2", "8 pending orders awaiting approval", "Oldest pending for 2 days", 0, "warning", False),
    ("N-3", "Invoice MF/25-26/01235 overdue", "INR 63,880 - due 6 days ago", 1, "danger", False),
    ("N-4", "Weekly demand forecast ready", "5 replenishment recommendations generated", 1, "info", True),
    ("N-5", "Goods receipt GRN-882 completed", "120 units added to Chennai Central WH", 1, "success", True),
]

DEMO_USERS = [
    ("USR-1", "Ananya Krishnan", "admin@mediflow.demo", "admin123", "admin", "Head of Operations", "AK", None),
    ("USR-2", "Karthik Iyer", "distributor@mediflow.demo", "distributor123", "distributor", "Distribution Manager", "KI", None),
    ("USR-3", "Priya Nandini", "retailer@mediflow.demo", "retailer123", "retailer", "NovaCare Pharmacy - Buyer", "PN", "RTL-02"),
]


def days_from_now(days):
    return date.today() + timedelta(days=days)


def days_ago(days):
    return date.today() - timedelta(days=days)


def seed_database(reset=False):
    if reset:
        db.drop_all()
        db.create_all()

    if User.query.first() is not None:
        raise RuntimeError("Database already contains users. Use --reset or an empty database.")

    roles = {}
    for role_name in ("admin", "distributor", "retailer"):
        role = Role(name=role_name, description=f"{role_name.title()} role")
        db.session.add(role)
        roles[role_name] = role
    db.session.flush()

    for retailer_id, name, city, contact, phone in RETAILER_SEED:
        db.session.add(
            Retailer(id=retailer_id, name=name, city=city, contact=contact, phone=phone)
        )

    for user_id, name, email, password, role_name, title, initials, retailer_id in DEMO_USERS:
        db.session.add(
            User(
                id=user_id,
                name=name,
                email=email,
                password_hash=generate_password_hash(password),
                role=roles[role_name],
                title=title,
                initials=initials,
                retailer_id=retailer_id,
                is_active=True,
            )
        )
    db.session.flush()

    retailers = {retailer.name: retailer for retailer in Retailer.query.all()}
    categories = {}
    suppliers = {}
    medicines = []
    batch_counter = 4200
    warehouses = ("Chennai Central WH", "Bengaluru South WH")

    for index, row in enumerate(MEDICINE_SEED):
        name, brand, strength, dosage_form, pack_size, category_name, unit_price, supplier_name = row
        category = categories.get(category_name)
        if category is None:
            category = Category(name=category_name)
            db.session.add(category)
            db.session.flush()
            categories[category_name] = category
        supplier = suppliers.get(supplier_name)
        if supplier is None:
            supplier = Supplier(name=supplier_name)
            db.session.add(supplier)
            db.session.flush()
            suppliers[supplier_name] = supplier

        shape = STOCK_SHAPE[index] if index < len(STOCK_SHAPE) else (2, 400, 150)
        offsets = EXPIRY_OFFSETS[index] if index < len(EXPIRY_OFFSETS) else (200, 400)
        batch_count, stock, reorder = shape
        per_batch = max(1, round(stock / max(batch_count, 1)))

        medicine = Medicine(
            id=f"MED-{index + 1:03d}",
            name=name,
            brand=brand,
            strength=strength,
            dosage_form=dosage_form,
            pack_size=pack_size,
            category=category,
            supplier=supplier,
            unit_price=money(unit_price),
            reorder_level=reorder,
            requires_prescription=category_name in ("Antibiotic", "Oncology"),
            is_active=True,
            is_sample=True,
        )
        db.session.add(medicine)
        medicines.append(medicine)

        for batch_index in range(max(batch_count, len(offsets))):
            batch_counter += 1
            offset = offsets[batch_index % len(offsets)] + batch_index * 11
            quantity = round(per_batch * 0.35) if offset <= 90 else per_batch
            batch = Batch(
                id=f"BATCH-{batch_counter}",
                medicine=medicine,
                batch_number=f"MF{str(2400 + batch_counter)[-4:]}",
                expiry_date=days_from_now(offset),
                received_date=days_ago(30 + batch_index * 21),
                cost_price=money(unit_price * 0.78),
                supplier=supplier,
                warehouse=warehouses[(index + batch_index) % 2],
            )
            db.session.add(batch)
            db.session.flush()
            db.session.add(Inventory(batch=batch, quantity=quantity))

    db.session.flush()
    medicine_map = {medicine.id: medicine for medicine in medicines}

    orders = []
    for index, (order_id, retailer_name, days_back, item_count, status, amount) in enumerate(ORDER_SEED):
        order_date = days_ago(days_back)
        order = Order(
            id=order_id,
            retailer_id=retailers[retailer_name].id,
            order_date=order_date,
            status=status,
            total_amount=money(amount),
            payment_terms="Net 30",
            warehouse=warehouses[index % 2],
        )
        db.session.add(order)
        db.session.flush()

        seed_offset = index * 5
        for item_index in range(item_count):
            medicine = medicines[(seed_offset + item_index * 3) % len(medicines)]
            quantity = 12 + ((seed_offset * 7 + item_index * 29) % 160)
            line_total = money(float(medicine.unit_price) * quantity)
            db.session.add(
                OrderItem(
                    id=f"ITM-{seed_offset}-{item_index}",
                    order=order,
                    medicine_id=medicine.id,
                    name=f"{medicine.name} {medicine.strength}",
                    brand=medicine.brand,
                    pack_size=medicine.pack_size,
                    quantity=quantity,
                    unit_price=money(medicine.unit_price),
                    line_total=line_total,
                )
            )

        for event_index, label in enumerate(STATUS_EVENTS[status]):
            db.session.add(
                OrderEvent(
                    order=order,
                    label=label,
                    timestamp=datetime.combine(
                        order_date, time(hour=9 + event_index * 2, minute=(index * 13) % 60)
                    ),
                    done=True,
                )
            )
        orders.append(order)

    db.session.flush()

    invoice_orders = [order for order in orders if order.status != "Cancelled"][:14]
    for index, order in enumerate(invoice_orders):
        issued = order.order_date
        due = issued + timedelta(days=30)
        paid = order.status in ("Delivered", "Shipped")
        overdue = not paid and due < date.today()
        db.session.add(
            Invoice(
                id=f"INV-{9025 + index}",
                invoice_number=f"MF/25-26/{str(1200 + index * 7).zfill(5)}",
                order=order,
                retailer_id=order.retailer_id,
                invoice_date=issued,
                due_date=due,
                total_amount=order.total_amount,
                tax_amount=money(float(order.total_amount) * 0.05),
                payment_status="Paid" if paid else ("Overdue" if overdue else "Pending"),
                paid_on=issued + timedelta(days=6) if paid else None,
            )
        )

    for movement_id, days_back, medicine_id, medicine_name, movement_type, quantity, reference, actor in MOVEMENT_SEED:
        medicine = medicine_map.get(medicine_id)
        db.session.add(
            StockMovement(
                id=movement_id,
                date=days_ago(days_back),
                medicine_id=medicine.id if medicine else None,
                type=movement_type,
                quantity=quantity,
                reference=reference,
                user=actor,
            )
        )

    for activity_id, activity_type, title, detail, days_back, actor in ACTIVITY_SEED:
        db.session.add(
            ActivityLog(
                id=activity_id,
                type=activity_type,
                title=title,
                detail=detail,
                time=days_ago(days_back),
                actor=actor,
            )
        )

    for notification_id, title, detail, days_back, tone, read in NOTIFICATION_SEED:
        db.session.add(
            Notification(
                id=notification_id,
                title=title,
                detail=detail,
                time=days_ago(days_back),
                tone=tone,
                read=read,
            )
        )

    counters = {
        "medicine": len(MEDICINE_SEED),
        "batch": batch_counter,
        "order": 2041,
        "invoice": 9038,
        "invoice_number": 1291,
        "movement": 100,
        "activity": 100,
        "user": 3,
        "retailer": 8,
        "adjustment": 113,
    }
    for name, value in counters.items():
        db.session.add(Counter(name=name, value=value))

    db.session.commit()


def reset_demo_data():
    """Delete and re-seed every table (used by `flask seed --reset`)."""
    seed_database(reset=True)
