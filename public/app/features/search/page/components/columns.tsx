import { css, cx } from '@emotion/css';
import React from 'react';
import SVG from 'react-inlinesvg';

import { Field } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Checkbox, Icon, IconName, TagList } from '@grafana/ui';
import { DefaultCell } from '@grafana/ui/src/components/Table/DefaultCell';

import { QueryResponse, SearchResultMeta } from '../../service';
import { SelectionChecker, SelectionToggle } from '../selection';

import { TableColumn } from './SearchResultsTable';

const TYPE_COLUMN_WIDTH = 250;
const DATASOURCE_COLUMN_WIDTH = 200;
const LOCATION_COLUMN_WIDTH = 200;
const TAGS_COLUMN_WIDTH = 300;

export const generateColumns = (
  response: QueryResponse,
  availableWidth: number,
  selection: SelectionChecker | undefined,
  selectionToggle: SelectionToggle | undefined,
  styles: { [key: string]: string },
  onTagSelected: (tag: string) => void,
  onDatasourceChange?: (datasource?: string) => void
): TableColumn[] => {
  const columns: TableColumn[] = [];
  const access = response.view.fields;
  const uidField = access.uid;
  const kindField = access.kind;

  let width = 50;

  if (selection && selectionToggle) {
    width = 30;
    columns.push({
      id: `column-checkbox`,
      width,
      Header: () => (
        <div className={styles.checkboxHeader}>
          <Checkbox
            onChange={(e) => {
              e.stopPropagation();
              e.preventDefault();
              alert('SELECT ALL!!!');
            }}
          />
        </div>
      ),
      Cell: (p) => {
        const uid = uidField.values.get(p.row.index);
        const kind = kindField ? kindField.values.get(p.row.index) : 'dashboard'; // HACK for now
        const selected = selection(kind, uid);
        const hasUID = uid != null; // Panels don't have UID! Likely should not be shown on pages with manage options
        return (
          <div {...p.cellProps} className={p.cellStyle}>
            <div className={styles.checkbox}>
              <Checkbox
                disabled={!hasUID}
                value={selected && hasUID}
                onChange={(e) => {
                  selectionToggle(kind, uid);
                }}
              />
            </div>
          </div>
        );
      },
      field: uidField,
    });
    availableWidth -= width;
  }

  // Name column
  width = Math.max(availableWidth * 0.2, 300);
  columns.push({
    Cell: (p) => {
      const name = access.name.values.get(p.row.index);
      return (
        <a {...p.cellProps} href={p.userProps.href} className={cx(p.cellStyle, styles.cellWrapper)}>
          {name}
        </a>
      );
    },
    id: `column-name`,
    field: access.name!,
    Header: 'Name',
    width,
  });
  availableWidth -= width;

  width = TYPE_COLUMN_WIDTH;
  columns.push(makeTypeColumn(access.kind, access.panel_type, width, styles));
  availableWidth -= width;

  // Show datasources if we have any
  if (access.ds_uid && onDatasourceChange) {
    width = DATASOURCE_COLUMN_WIDTH;
    columns.push(
      makeDataSourceColumn(
        access.ds_uid,
        width,
        styles.typeIcon,
        styles.datasourceItem,
        styles.invalidDatasourceItem,
        onDatasourceChange
      )
    );
    availableWidth -= width;
  }

  width = Math.max(availableWidth - TAGS_COLUMN_WIDTH, LOCATION_COLUMN_WIDTH);
  const meta = response.view.dataFrame.meta?.custom as SearchResultMeta;
  if (meta?.locationInfo) {
    columns.push({
      Cell: (p) => {
        const parts = (access.location?.values.get(p.row.index) ?? '').split('/');
        return (
          <div
            {...p.cellProps}
            className={cx(
              p.cellStyle,
              css`
                padding-right: 10px;
              `
            )}
          >
            {parts.map((p) => {
              const info = meta.locationInfo[p];
              return info ? (
                <a key={p} href={info.url} className={styles.locationItem}>
                  <Icon name={getIconForKind(info.kind)} /> {info.name}
                </a>
              ) : (
                <span key={p}>{p}</span>
              );
            })}
          </div>
        );
      },
      id: `column-location`,
      field: access.location ?? access.url,
      Header: 'Location',
      width,
    });
    availableWidth -= width;
  }

  columns.push(makeTagsColumn(access.tags, availableWidth, styles.tagList, onTagSelected));

  return columns;
};

function getIconForKind(v: string): IconName {
  if (v === 'dashboard') {
    return 'apps';
  }
  if (v === 'folder') {
    return 'folder';
  }
  return 'question-circle';
}

function makeDataSourceColumn(
  field: Field<string[]>,
  width: number,
  iconClass: string,
  datasourceItemClass: string,
  invalidDatasourceItemClass: string,
  onDatasourceChange: (datasource?: string) => void
): TableColumn {
  const srv = getDataSourceSrv();
  return {
    id: `column-datasource`,
    field,
    Header: 'Data source',
    Cell: (p) => {
      const dslist = field.values.get(p.row.index);
      if (!dslist?.length) {
        return null;
      }
      return (
        <div {...p.cellProps} className={cx(p.cellStyle, datasourceItemClass)}>
          {dslist.map((v, i) => {
            const settings = srv.getInstanceSettings(v);
            const icon = settings?.meta?.info?.logos?.small;
            if (icon) {
              return (
                <span
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDatasourceChange(settings.uid);
                  }}
                >
                  <img src={icon} width={14} height={14} title={settings.type} className={iconClass} />
                  {settings.name}
                </span>
              );
            }
            return (
              <span className={invalidDatasourceItemClass} key={i}>
                {v}
              </span>
            );
          })}
        </div>
      );
    },
    width,
  };
}

function makeTypeColumn(
  kindField: Field<string>,
  typeField: Field<string>,
  width: number,
  styles: Record<string, string>
): TableColumn {
  return {
    Cell: DefaultCell,
    id: `column-type`,
    field: kindField ?? typeField,
    Header: 'Type',
    accessor: (row: any, i: number) => {
      const kind = kindField?.values.get(i) ?? 'dashboard';
      let icon = 'public/img/icons/unicons/apps.svg';
      let txt = 'Dashboard';
      if (kind) {
        txt = kind;
        switch (txt) {
          case 'dashboard':
            txt = 'Dashboard';
            break;

          case 'folder':
            icon = 'public/img/icons/unicons/folder.svg';
            txt = 'Folder';
            break;

          case 'panel':
            icon = 'public/img/icons/unicons/graph-bar.svg';
            const type = typeField.values.get(i);
            if (type) {
              txt = type;
              const info = config.panels[txt];
              if (info?.name) {
                const v = info.info?.logos.small;
                if (v && v.endsWith('.svg')) {
                  icon = v;
                }
                txt = info.name;
              }
            }
            break;
        }
      }
      return (
        <div className={styles.typeText}>
          <SVG src={icon} width={14} height={14} title={txt} className={styles.typeIcon} />
          {txt}
        </div>
      );
    },
    width,
  };
}

function makeTagsColumn(
  field: Field<string[]>,
  width: number,
  tagListClass: string,
  onTagSelected: (tag: string) => void
): TableColumn {
  return {
    Cell: (p) => {
      const tags = field.values.get(p.row.index);
      return tags ? (
        <div {...p.cellProps} className={p.cellStyle}>
          <TagList className={tagListClass} tags={tags} onClick={onTagSelected} />
        </div>
      ) : null;
    },
    id: `column-tags`,
    field: field,
    Header: 'Tags',
    width,
  };
}
