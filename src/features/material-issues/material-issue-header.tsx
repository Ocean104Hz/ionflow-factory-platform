"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { MaterialIssueProductPickerModal } from "./material-issue-product-picker-modal";
import { SectionCard } from "@/src/components/factory/patterns";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";

import {
    MATERIAL_ISSUE_LOCATIONS,
    type MaterialIssueHeaderValues,
} from "./material-issue-domain";

type MaterialIssueHeaderProps = {
    documentNo?: string;
    onDocumentNoChange: (value: string) => void;
    values: MaterialIssueHeaderValues;
    onChange: (
        field: keyof MaterialIssueHeaderValues,
        value: string,
    ) => void;
};

export function MaterialIssueHeader({
    documentNo = "",
    onDocumentNoChange,
    values,
    onChange,
}: MaterialIssueHeaderProps) {
    const locationListId = useId();

    const locationInputRef =
        useRef<HTMLInputElement>(null);

    const [locationOpen, setLocationOpen] =
        useState(false);

    const [locationSearch, setLocationSearch] =
        useState("");

    const [activeIndex, setActiveIndex] =
        useState(-1);
    const [productPickerOpen, setProductPickerOpen] =
        useState(false);

    const filteredLocations =
        MATERIAL_ISSUE_LOCATIONS.filter(
            (location) =>
                location
                    .toLowerCase()
                    .includes(
                        locationSearch.trim().toLowerCase(),
                    ),
        );

    function handleSelectLocation(
        location: string,
    ): void {
        onChange("location", location);
        setLocationSearch("");
        setLocationOpen(false);
        setActiveIndex(-1);
    }

    return (
        <SectionCard
            title="ข้อมูลใบเบิกจ่ายวัสดุ"
            className="relative z-20 overflow-visible"
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
                {/* วันที่ */}
                <div className="factory-itech-date-filter min-w-0">
                    <ThaiBuddhistDatePicker
                        label="วันที่"
                        value={values.issueDate}
                        onChange={(value) =>
                            onChange("issueDate", value)
                        }
                    />
                </div>
                {/* สถานที่ */}
                <div className="space-y-2">
                    <Label htmlFor="issue-location">
                        สถานที่
                    </Label>

                    <div
                        className="relative"
                        onBlur={(event) => {
                            if (
                                !event.currentTarget.contains(
                                    event.relatedTarget,
                                )
                            ) {
                                setLocationOpen(false);
                                setLocationSearch("");
                                setActiveIndex(-1);
                            }
                        }}
                    >
                        <Input
                            ref={locationInputRef}
                            id="issue-location"
                            type="text"
                            autoComplete="off"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={locationOpen}
                            aria-controls={
                                locationOpen
                                    ? locationListId
                                    : undefined
                            }
                            aria-activedescendant={
                                locationOpen &&
                                    activeIndex >= 0 &&
                                    filteredLocations[activeIndex]
                                    ? `${locationListId}-${activeIndex}`
                                    : undefined
                            }
                            value={values.location}
                            placeholder="เลือกหรือพิมพ์สถานที่"
                            className="pr-9 focus-visible:border-muted-foreground focus-visible:ring-0"
                            onFocus={() => {
                                setLocationSearch("");
                                setLocationOpen(true);
                                setActiveIndex(-1);
                            }}
                            onChange={(event) => {
                                const value = event.target.value;

                                onChange("location", value);
                                setLocationSearch(value);
                                setLocationOpen(true);
                                setActiveIndex(-1);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    setLocationOpen(false);
                                    setActiveIndex(-1);
                                    return;
                                }

                                if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    setLocationOpen(true);

                                    setActiveIndex((previous) =>
                                        Math.min(
                                            previous + 1,
                                            filteredLocations.length - 1,
                                        ),
                                    );
                                    return;
                                }

                                if (event.key === "ArrowUp") {
                                    event.preventDefault();

                                    setActiveIndex((previous) =>
                                        Math.max(previous - 1, 0),
                                    );
                                    return;
                                }

                                if (
                                    event.key === "Enter" &&
                                    locationOpen
                                ) {
                                    event.preventDefault();

                                    const selected =
                                        filteredLocations[activeIndex];

                                    if (selected) {
                                        handleSelectLocation(selected);
                                    }
                                }
                            }}
                        />

                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label="เปิดรายการสถานที่"
                            aria-expanded={locationOpen}
                            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                            onMouseDown={(event) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                if (locationOpen) {
                                    setLocationOpen(false);
                                    setActiveIndex(-1);
                                } else {
                                    setLocationSearch("");
                                    setLocationOpen(true);
                                    locationInputRef.current?.focus();
                                }
                            }}
                        >
                            <ChevronDown
                                className={`size-4 transition-transform ${locationOpen ? "rotate-180" : ""
                                    }`}
                            />
                        </button>

                        {locationOpen && (
                            <div
                                id={locationListId}
                                role="listbox"
                                aria-label="รายการสถานที่"
                                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                            >
                                {filteredLocations.length > 0 ? (
                                    filteredLocations.map(
                                        (location, index) => (
                                            <button
                                                key={location}
                                                id={`${locationListId}-${index}`}
                                                type="button"
                                                role="option"
                                                tabIndex={-1}
                                                aria-selected={
                                                    values.location === location
                                                }
                                                className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${activeIndex === index
                                                    ? "bg-accent"
                                                    : ""
                                                    }`}
                                                onMouseDown={(event) =>
                                                    event.preventDefault()
                                                }
                                                onClick={() =>
                                                    handleSelectLocation(location)
                                                }
                                            >
                                                <span>{location}</span>

                                                {values.location === location && (
                                                    <Check className="size-4" />
                                                )}
                                            </button>
                                        ),
                                    )
                                ) : (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                        ไม่พบสถานที่
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {/* เลขที่เอกสาร */}
                <div className="space-y-2">
                    <Label htmlFor="issue-document-no">
                        เลขที่เอกสาร
                    </Label>

                    <Input
                        id="issue-document-no"
                        type="text"
                        inputMode="numeric"
                        value={documentNo}
                        placeholder="กรอกเลขที่เอกสาร"
                        maxLength={100}
                        onChange={(event) =>
                            onDocumentNoChange(
                                event.target.value.replace(/[^0-9]/g, ""),
                            )
                        }
                    />
                </div>

                {/* ชื่อผลิตภัณฑ์ */}
                <div className="space-y-2">
                    <Label htmlFor="issue-product-name">
                        ชื่อผลิตภัณฑ์
                    </Label>

                    <button
                        id="issue-product-name"
                        type="button"
                        aria-haspopup="dialog"
                        title={
                            values.productName ||
                            "คลิกเพื่อค้นหาผลิตภัณฑ์"
                        }
                        onClick={() => setProductPickerOpen(true)}
                        className="flex h-9 w-full min-w-0 items-center justify-between overflow-hidden rounded-md border border-input bg-transparent text-left text-sm shadow-xs transition-colors hover:bg-muted/50 focus-visible:border-muted-foreground focus-visible:outline-none"
                    >
                        <span
                            className={`min-w-0 flex-1 truncate px-3 ${values.productName
                                ? "text-foreground"
                                : "text-muted-foreground"
                                }`}
                        >
                            {values.productName ||
                                "คลิกเพื่อค้นหาผลิตภัณฑ์"}
                        </span>

                        <span className="flex h-6 w-9 shrink-0 items-center justify-center border-l border-border text-muted-foreground">
                            <Search
                                className="size-4"
                                aria-hidden="true"
                            />
                        </span>
                    </button>

                    {productPickerOpen && (
                        <MaterialIssueProductPickerModal
                            selectedName={values.productName}
                            onSelect={(product) => {
                                onChange(
                                    "productName",
                                    product.item.name.trim(),
                                );

                                setProductPickerOpen(false);
                            }}
                            onClose={() =>
                                setProductPickerOpen(false)
                            }
                        />
                    )}
                </div>

                {/* จำนวน */}
                <div className="space-y-2">
                    <Label htmlFor="issue-quantity">
                        จำนวน
                    </Label>

                    <Input
                        id="issue-quantity"
                        type="number"
                        min="0"
                        step="any"
                        value={values.quantity}
                        placeholder="ระบุจำนวน"
                        onChange={(event) =>
                            onChange(
                                "quantity",
                                event.target.value,
                            )
                        }
                    />
                </div>
                {/* ฝ่าย */}
                <div className="space-y-2">
                    <Label htmlFor="issue-department">
                        ฝ่าย
                    </Label>

                    <Input
                        id="issue-department"
                        value={values.department}
                        placeholder="ระบุฝ่าย"
                        onChange={(event) =>
                            onChange(
                                "department",
                                event.target.value,
                            )
                        }
                    />
                </div>

            </div>
        </SectionCard>
    );
}