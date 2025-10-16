from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, ForeignKey, Text
from sqlalchemy import Float, BigInteger
from sqlalchemy.orm import relationship
from backend.db.base import Base

class TBrand(Base):
    __tablename__ = "T_BRAND"
    id_brand = Column(Integer, primary_key=True, nullable=False)
    brand_name = Column(String(45), nullable=False)

class TEqptCred(Base):
    __tablename__ = "T_EQPT_CRED"
    cred_id = Column(Integer, primary_key=True, nullable=False)
    T_EQPT_CRED_TYPE_id_cred_type = Column(Integer, ForeignKey('T_EQPT_CRED_TYPE.idT_EQPT_CRED_TYPE'), nullable=False)
    T_EQUIPMENT_id_equipment = Column(Integer, ForeignKey('T_EQUIPMENT.id_equipment'), nullable=True)
    usr = Column(String(45), nullable=True)
    pwd = Column(String(45), nullable=True)
    port = Column(String(45), nullable=True)
    eqpt_cred_type = relationship('TEqptCredType', backref='t_eqpt_cred')
    equipment = relationship('TEquipment', backref='t_eqpt_cred')

class TEqptCredType(Base):
    __tablename__ = "T_EQPT_CRED_TYPE"
    idT_EQPT_CRED_TYPE = Column(Integer, primary_key=True, nullable=False)
    cr_type = Column(String(45), nullable=False)

class TEquipment(Base):
    __tablename__ = "T_EQUIPMENT"
    id_equipment = Column(Integer, primary_key=True, nullable=False)
    name = Column(String(45), nullable=False)
    T_EQUIP_TYPE_id_type = Column(Integer, ForeignKey('T_EQUIP_TYPE.id_type'), nullable=False)
    T_NET_id_ip = Column(Integer, ForeignKey('T_NET.id_ip'), nullable=False)
    virtual_id = Column(Integer, nullable=False)
    T_LOCATION_id_location = Column(Integer, ForeignKey('T_LOCATION.id_location'), nullable=False)
    T_SCOPE_id_scope = Column(Integer, ForeignKey('T_SCOPE.id_scope'), nullable=False)
    T_PACKAGES_id_pack = Column(Integer, ForeignKey('T_PACKAGES.id_pack'), nullable=True)
    owner = Column(String(45), nullable=True)
    inUse = Column(Boolean, nullable=True)
    description = Column(String(64), nullable=True)
    note = Column(String(64), nullable=True)
    T_LIB_id_lib = Column(Integer, ForeignKey('T_LIB.id_lib'), nullable=False)
    T_BRAND_id_brand = Column(Integer, ForeignKey('T_BRAND.id_brand'), nullable=True)
    brand = relationship('TBrand', backref='t_equipment')
    equip_type = relationship('TEquipType', backref='t_equipment')
    lib = relationship('TLib', backref='t_equipment')
    location = relationship('TLocation', backref='t_equipment')
    net = relationship('TNet', backref='t_equipment')
    packages = relationship('TPackages', backref='t_equipment')
    scope = relationship('TScope', backref='t_equipment')

class TEquipType(Base):
    __tablename__ = "T_EQUIP_TYPE"
    id_type = Column(Integer, primary_key=True, nullable=False)
    name = Column(String(45), nullable=False)
    description = Column(String(45), nullable=True)
    family = Column(String(45), nullable=False)

class TLib(Base):
    __tablename__ = "T_LIB"
    id_lib = Column(Integer, primary_key=True, nullable=False)
    lib_name = Column(String(45), nullable=False)
    to_be_used = Column(Integer, nullable=False)

class TLibDomain(Base):
    __tablename__ = "T_LIB_DOMAIN"
    id_lib_domain = Column(Integer, primary_key=True, nullable=False)
    T_EQUIP_TYPE_id_type = Column(Integer, ForeignKey('T_EQUIP_TYPE.id_type'), primary_key=True, nullable=False)
    T_LIB_id_lib = Column(Integer, ForeignKey('T_LIB.id_lib'), primary_key=True, nullable=False)
    equip_type = relationship('TEquipType', backref='t_lib_domain')
    lib = relationship('TLib', backref='t_lib_domain')

class TLocation(Base):
    __tablename__ = "T_LOCATION"
    id_location = Column(Integer, primary_key=True, nullable=False)
    site = Column(String(45), nullable=True)
    room = Column(String(45), nullable=True)
    row = Column(String(45), nullable=True)
    rack = Column(String(5), nullable=True)
    pos = Column(Integer, nullable=True)

class TNet(Base):
    __tablename__ = "T_NET"
    id_ip = Column(Integer, primary_key=True, nullable=False)
    inUse = Column(Boolean, nullable=False)
    description = Column(String(45), nullable=True)
    protocol = Column(String, nullable=False)
    IP = Column(String(45), nullable=False)
    NM = Column(String(45), nullable=True)
    GW = Column(String(45), nullable=True)

class TPackages(Base):
    __tablename__ = "T_PACKAGES"
    id_pack = Column(Integer, primary_key=True, nullable=False)
    T_PROD_id_prod = Column(Integer, ForeignKey('T_PROD.id_prod'), nullable=False)
    T_BRAND_id_brand = Column(Integer, ForeignKey('T_BRAND.id_brand'), nullable=False)
    T_SW_REL_id_sw_rel = Column(String(45), ForeignKey('T_SW_REL.id_sw_rel'), nullable=False)
    label_ref = Column(String(32), nullable=True)
    label_swp = Column(String(128), nullable=True)
    arch = Column(String(32), nullable=False)
    author = Column(String(45), nullable=False)
    notes = Column(String(45), nullable=True)
    ts_build = Column(DateTime, nullable=True)
    ts_devel = Column(DateTime, nullable=True)
    ts_valid = Column(DateTime, nullable=True)
    ts_final = Column(DateTime, nullable=True)
    reference = Column(String(512), nullable=False)
    brand = relationship('TBrand', backref='t_packages')
    prod = relationship('TProd', backref='t_packages')
    sw_rel = relationship('TSwRel', backref='t_packages')

class TProd(Base):
    __tablename__ = "T_PROD"
    id_prod = Column(Integer, primary_key=True, nullable=False)
    product = Column(String(45), nullable=False)

class TScope(Base):
    __tablename__ = "T_SCOPE"
    id_scope = Column(Integer, primary_key=True, nullable=False)
    description = Column(String(45), nullable=False)

class TSwRel(Base):
    __tablename__ = "T_SW_REL"
    id_sw_rel = Column(String(45), primary_key=True, nullable=False)
    sw_rel_name = Column(String(45), nullable=True)
