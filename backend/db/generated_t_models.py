from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.db.base import Base

class TBrand(Base):
    __tablename__ = 'T_BRAND'
    id_brand = Column(Integer, nullable=False)
    brand_name = Column(String, nullable=False)


class TEqptCred(Base):
    __tablename__ = 'T_EQPT_CRED'
    cred_id = Column(Integer, nullable=False)
    T_EQPT_CRED_TYPE_id_cred_type = Column(Integer, nullable=False)
    T_EQUIPMENT_id_equipment = Column(Integer)
    usr = Column(String)
    pwd = Column(String)
    port = Column(String)
    # FK: T_EQPT_CRED_TYPE_id_cred_type -> T_EQPT_CRED_TYPE.idT_EQPT_CRED_TYPE
    t_eqpt_cred_type = relationship('TEqptCredType', primaryjoin='T_EQPT_CRED.T_EQPT_CRED_TYPE_id_cred_type==TEqptCredType.idT_EQPT_CRED_TYPE')
    # FK: T_EQUIPMENT_id_equipment -> T_EQUIPMENT.id_equipment
    t_equipment = relationship('TEquipment', primaryjoin='T_EQPT_CRED.T_EQUIPMENT_id_equipment==TEquipment.id_equipment')


class TEqptCredType(Base):
    __tablename__ = 'T_EQPT_CRED_TYPE'
    idT_EQPT_CRED_TYPE = Column(Integer, nullable=False)
    cr_type = Column(String, nullable=False)


class TEquipment(Base):
    __tablename__ = 'T_EQUIPMENT'
    id_equipment = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    T_EQUIP_TYPE_id_type = Column(Integer, nullable=False)
    T_NET_id_ip = Column(Integer, nullable=False)
    virtual_id = Column(Integer, nullable=False)
    T_LOCATION_id_location = Column(Integer, nullable=False)
    T_SCOPE_id_scope = Column(Integer, nullable=False)
    T_PACKAGES_id_pack = Column(Integer)
    owner = Column(String)
    inUse = Column(Integer)
    description = Column(String)
    note = Column(String)
    T_LIB_id_lib = Column(Integer, nullable=False)
    T_BRAND_id_brand = Column(Integer)
    # FK: T_BRAND_id_brand -> T_BRAND.id_brand
    t_brand = relationship('TBrand', primaryjoin='T_EQUIPMENT.T_BRAND_id_brand==TBrand.id_brand')
    # FK: T_EQUIP_TYPE_id_type -> T_EQUIP_TYPE.id_type
    t_equip_type = relationship('TEquipType', primaryjoin='T_EQUIPMENT.T_EQUIP_TYPE_id_type==TEquipType.id_type')
    # FK: T_LIB_id_lib -> T_LIB.id_lib
    t_lib = relationship('TLib', primaryjoin='T_EQUIPMENT.T_LIB_id_lib==TLib.id_lib')
    # FK: T_LOCATION_id_location -> T_LOCATION.id_location
    t_location = relationship('TLocation', primaryjoin='T_EQUIPMENT.T_LOCATION_id_location==TLocation.id_location')
    # FK: T_NET_id_ip -> T_NET.id_ip
    t_net = relationship('TNet', primaryjoin='T_EQUIPMENT.T_NET_id_ip==TNet.id_ip')
    # FK: T_PACKAGES_id_pack -> T_PACKAGES.id_pack
    t_packages = relationship('TPackages', primaryjoin='T_EQUIPMENT.T_PACKAGES_id_pack==TPackages.id_pack')
    # FK: T_SCOPE_id_scope -> T_SCOPE.id_scope
    t_scope = relationship('TScope', primaryjoin='T_EQUIPMENT.T_SCOPE_id_scope==TScope.id_scope')


class TEquipType(Base):
    __tablename__ = 'T_EQUIP_TYPE'
    id_type = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String)
    family = Column(String, nullable=False)


class TLib(Base):
    __tablename__ = 'T_LIB'
    id_lib = Column(Integer, nullable=False)
    lib_name = Column(String, nullable=False)
    to_be_used = Column(Integer, nullable=False)


class TLibDomain(Base):
    __tablename__ = 'T_LIB_DOMAIN'
    id_lib_domain = Column(Integer, nullable=False)
    T_EQUIP_TYPE_id_type = Column(Integer, nullable=False)
    T_LIB_id_lib = Column(Integer, nullable=False)
    # FK: T_EQUIP_TYPE_id_type -> T_EQUIP_TYPE.id_type
    t_equip_type = relationship('TEquipType', primaryjoin='T_LIB_DOMAIN.T_EQUIP_TYPE_id_type==TEquipType.id_type')
    # FK: T_LIB_id_lib -> T_LIB.id_lib
    t_lib = relationship('TLib', primaryjoin='T_LIB_DOMAIN.T_LIB_id_lib==TLib.id_lib')


class TLocation(Base):
    __tablename__ = 'T_LOCATION'
    id_location = Column(Integer, nullable=False)
    site = Column(String)
    room = Column(String)
    row = Column(String)
    rack = Column(String)
    pos = Column(Integer)


class TNet(Base):
    __tablename__ = 'T_NET'
    id_ip = Column(Integer, nullable=False)
    inUse = Column(Integer, nullable=False)
    description = Column(String)
    protocol = Column(String, nullable=False)
    IP = Column(String, nullable=False)
    NM = Column(String)
    GW = Column(String)


class TPackages(Base):
    __tablename__ = 'T_PACKAGES'
    id_pack = Column(Integer, nullable=False)
    T_PROD_id_prod = Column(Integer, nullable=False)
    T_BRAND_id_brand = Column(Integer, nullable=False)
    T_SW_REL_id_sw_rel = Column(String, nullable=False)
    label_ref = Column(String)
    label_swp = Column(String)
    arch = Column(String, nullable=False)
    author = Column(String, nullable=False)
    notes = Column(String)
    ts_build = Column(DateTime)
    ts_devel = Column(DateTime)
    ts_valid = Column(DateTime)
    ts_final = Column(DateTime)
    reference = Column(String, nullable=False)
    # FK: T_BRAND_id_brand -> T_BRAND.id_brand
    t_brand = relationship('TBrand', primaryjoin='T_PACKAGES.T_BRAND_id_brand==TBrand.id_brand')
    # FK: T_PROD_id_prod -> T_PROD.id_prod
    t_prod = relationship('TProd', primaryjoin='T_PACKAGES.T_PROD_id_prod==TProd.id_prod')
    # FK: T_SW_REL_id_sw_rel -> T_SW_REL.id_sw_rel
    t_sw_rel = relationship('TSwRel', primaryjoin='T_PACKAGES.T_SW_REL_id_sw_rel==TSwRel.id_sw_rel')


class TProd(Base):
    __tablename__ = 'T_PROD'
    id_prod = Column(Integer, nullable=False)
    product = Column(String, nullable=False)


class TScope(Base):
    __tablename__ = 'T_SCOPE'
    id_scope = Column(Integer, nullable=False)
    description = Column(String, nullable=False)


class TSwRel(Base):
    __tablename__ = 'T_SW_REL'
    id_sw_rel = Column(String, nullable=False)
    sw_rel_name = Column(String)

