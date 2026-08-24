import type { CfihosProperty } from "../model/property";
import type { CfihosTagClass } from "../model/tagClass";
import { cfihosRepository } from "./CfihosRepository";

export type CfihosPropertyUsage = {
  property: CfihosProperty;
  tagClasses: CfihosTagClass[];
};

export class CfihosPropertyRepository {
  private usageIndex: Map<string, CfihosTagClass[]> | null = null;

  async getProperties(): Promise<CfihosProperty[]> {
    return cfihosRepository.getProperties();
  }

  async getProperty(
    propertyId: string,
  ): Promise<CfihosProperty | null> {
    return cfihosRepository.getProperty(propertyId);
  }

  async searchProperties(
    query: string,
  ): Promise<CfihosProperty[]> {
    const properties = await this.getProperties();

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [...properties].sort(compareProperties);
    }

    return properties
      .filter((property) => {
        const searchableValues = [
          property.id,
          property.name,
          property.definition,
          property.dataType,
          property.unitOfMeasureDimensionCode,
          property.picklistName,
          property.existenceReason,
          ...property.synonyms,
        ];

        return searchableValues.some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort(compareProperties);
  }

  async getTagClassesUsingProperty(
    propertyId: string,
  ): Promise<CfihosTagClass[]> {
    const index = await this.getUsageIndex();

    return index.get(propertyId) ?? [];
  }

  async getPropertyUsage(
    propertyId: string,
  ): Promise<CfihosPropertyUsage | null> {
    const [property, tagClasses] = await Promise.all([
      this.getProperty(propertyId),
      this.getTagClassesUsingProperty(propertyId),
    ]);

    if (!property) {
      return null;
    }

    return {
      property,
      tagClasses,
    };
  }

  async getPicklistValues(propertyId: string) {
    return cfihosRepository.getPropertyPicklistValues(
      propertyId,
    );
  }

  private async getUsageIndex(): Promise<
    Map<string, CfihosTagClass[]>
  > {
    if (this.usageIndex) {
      return this.usageIndex;
    }

    const tagClasses =
      await cfihosRepository.getTagClasses();

    const usageIndex = new Map<
      string,
      CfihosTagClass[]
    >();

    await Promise.all(
      tagClasses.map(async (tagClass) => {
        const assignments =
          await cfihosRepository.getTagClassProperties(
            tagClass.id,
          );

        for (const assignment of assignments) {
          const propertyId = assignment.property.id;

          const existing =
            usageIndex.get(propertyId) ?? [];

          existing.push(tagClass);

          usageIndex.set(propertyId, existing);
        }
      }),
    );

    for (const classes of usageIndex.values()) {
      classes.sort((a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          {
            sensitivity: "base",
          },
        ),
      );
    }

    this.usageIndex = usageIndex;

    return usageIndex;
  }
}

function compareProperties(
  a: CfihosProperty,
  b: CfihosProperty,
): number {
  return a.name.localeCompare(
    b.name,
    undefined,
    {
      sensitivity: "base",
    },
  );
}

export const cfihosPropertyRepository =
  new CfihosPropertyRepository();